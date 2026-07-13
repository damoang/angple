/**
 * 리액션 사용자 목록 API (이모지 닉네임 공개, 2026-07-12 시행)
 * GET /api/reactions/reactors?targetId=document:free:123&limit=50
 *
 * 시행일(REACTOR_REVEAL_SINCE) 이후의 리액션만 닉네임을 공개하고,
 * 그 이전 리액션은 익명 약속대로 소급 공개하지 않고 건수만 집계해 반환한다.
 * (공지 free/6678912 · 건의 bug/12482, bug/12804)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

/** 공개 시행 시점 — g5_da_reaction_choose.created_at 은 KST 로 저장되므로 그대로 비교. */
const REACTOR_REVEAL_SINCE = '2026-07-12 00:00:00';

const MAX_LIMIT = 100;
const TARGET_ID_RE = /^(document|comment):[a-z0-9_]+:\d+$/;

function toSafeIso(raw: unknown): string {
    const s = typeof raw === 'string' ? raw : raw == null ? '' : String(raw);
    if (!s || s.startsWith('0000')) return '';
    return s.replace(' ', 'T') + 'Z';
}

interface ReactorRow extends RowDataPacket {
    member_id: string;
    mb_nick: string;
    mb_name: string;
    mb_image_url: string;
    mb_image_updated_at: string | null;
    reaction: string;
    created_at: string;
}

interface CountRow extends RowDataPacket {
    cnt: number;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
    const targetId = url.searchParams.get('targetId') || '';
    if (!TARGET_ID_RE.test(targetId)) {
        return json({ success: false, message: 'targetId가 올바르지 않습니다.' }, { status: 400 });
    }
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, MAX_LIMIT);

    // 추천자 목록과 동일 기준: 회원에게만 목록 공개
    const user = await getAuthUser(cookies).catch(() => null);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const [[rows], [anonRows]] = await Promise.all([
            pool.query<ReactorRow[]>(
                `SELECT c.member_id, m.mb_nick, m.mb_name,
                        COALESCE(m.mb_image_url, '') AS mb_image_url,
                        m.mb_image_updated_at,
                        c.reaction, c.created_at
                 FROM g5_da_reaction_choose c
                 JOIN g5_member m ON c.member_id = m.mb_id
                 WHERE c.target_id = ? AND c.created_at >= ?
                 ORDER BY c.created_at DESC
                 LIMIT ?`,
                [targetId, REACTOR_REVEAL_SINCE, limit]
            ),
            pool.query<CountRow[]>(
                `SELECT COUNT(*) AS cnt FROM g5_da_reaction_choose
                 WHERE target_id = ? AND created_at < ?`,
                [targetId, REACTOR_REVEAL_SINCE]
            )
        ]);

        const anonymousCount = Number(anonRows[0]?.cnt ?? 0);

        // 회원별로 묶어 한 줄에 이모지 여러 개로 표시.
        // rows 는 created_at DESC → 회원 첫 등장이 그 회원의 최신 시각.
        // (member,target,reaction) 은 u_reaction UNIQUE 라 회원별 reaction 중복 없음.
        const byMember = new Map<
            string,
            {
                mb_id: string;
                mb_nick: string;
                mb_image: string;
                mb_image_updated_at: string | undefined;
                reactions: string[];
                reacted_at: string;
            }
        >();
        for (const r of rows) {
            const existing = byMember.get(r.member_id);
            if (existing) {
                existing.reactions.push(r.reaction);
            } else {
                byMember.set(r.member_id, {
                    mb_id: r.member_id,
                    mb_nick: r.mb_nick || r.mb_name || r.member_id,
                    mb_image: r.mb_image_url || '',
                    mb_image_updated_at: r.mb_image_updated_at || undefined,
                    reactions: [r.reaction],
                    reacted_at: toSafeIso(r.created_at)
                });
            }
        }

        return json({
            success: true,
            data: {
                reactors: [...byMember.values()],
                anonymousCount,
                total: rows.length + anonymousCount,
                revealSince: REACTOR_REVEAL_SINCE
            }
        });
    } catch (err) {
        console.error('[reactions/reactors] 조회 실패:', err);
        return json({ success: false, message: '조회에 실패했습니다.' }, { status: 500 });
    }
};
