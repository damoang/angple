/**
 * 리액션 API (da_reaction 호환)
 *
 * PHP da_reaction 플러그인과 동일한 DB 테이블/컬럼/로직 사용
 * - g5_da_reaction: 집계 카운트 (target_id, reaction, reaction_count)
 * - g5_da_reaction_choose: 개별 선택 로그 (member_id, target_id, reaction, chosen_ip)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

const REACTION_LIMIT = 20;
const VALID_REACTION_PATTERN = /^[a-zA-Z0-9:_-]+$/;

interface ReactionRow extends RowDataPacket {
    target_id: string;
    reaction: string;
    reaction_count: number;
}

interface ChooseRow extends RowDataPacket {
    target_id: string;
    reaction: string;
}

interface CountRow extends RowDataPacket {
    reactionRows: number;
}

interface ChooseCountRow extends RowDataPacket {
    count: number;
}

function parseReaction(reaction: string, count: number, choose: boolean) {
    const idx = reaction.indexOf(':');
    return {
        reaction,
        category: idx >= 0 ? reaction.substring(0, idx) : reaction,
        reactionId: idx >= 0 ? reaction.substring(idx + 1) : reaction,
        count,
        choose
    };
}

/** PHP sanitizeTargetId와 동일: /[^a-zA-Z0-9:_-]/ */
function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9:_-]/g, '');
}

/**
 * GET - 리액션 조회
 * ?targetId=document:free:12345 (단일 대상)
 * ?parentId=document:free:12345 (게시글 + 모든 댓글)
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
    const targetId = url.searchParams.get('targetId');
    const parentId = url.searchParams.get('parentId');

    if (!targetId && !parentId) {
        return json(
            { status: 'error', message: 'targetId 또는 parentId가 필요합니다.' },
            { status: 400 }
        );
    }

    try {
        const user = await getAuthUser(cookies);
        const memberId = user?.mb_id || '';

        let reactions: ReactionRow[];
        let memberChoices: ChooseRow[];

        if (parentId) {
            const safeParentId = sanitizeId(parentId);

            // 부모 기준 전체 리액션 (게시글 + 모든 댓글)
            [reactions] = await pool.query<ReactionRow[]>(
                `SELECT target_id, reaction, reaction_count FROM g5_da_reaction
				 WHERE parent_id = ? ORDER BY id ASC`,
                [safeParentId]
            );

            if (memberId) {
                [memberChoices] = await pool.query<ChooseRow[]>(
                    `SELECT target_id, reaction FROM g5_da_reaction_choose
					 WHERE member_id = ? AND parent_id = ?`,
                    [memberId, safeParentId]
                );
            } else {
                memberChoices = [];
            }
        } else {
            const safeTargetId = sanitizeId(targetId!);

            [reactions] = await pool.query<ReactionRow[]>(
                `SELECT target_id, reaction, reaction_count FROM g5_da_reaction
				 WHERE target_id = ? ORDER BY id ASC`,
                [safeTargetId]
            );

            if (memberId) {
                [memberChoices] = await pool.query<ChooseRow[]>(
                    `SELECT target_id, reaction FROM g5_da_reaction_choose
					 WHERE member_id = ? AND target_id = ?`,
                    [memberId, safeTargetId]
                );
            } else {
                memberChoices = [];
            }
        }

        // 사용자 선택 맵 생성
        const chooseMap = new Map<string, Set<string>>();
        for (const row of memberChoices) {
            if (!chooseMap.has(row.target_id)) {
                chooseMap.set(row.target_id, new Set());
            }
            chooseMap.get(row.target_id)!.add(row.reaction);
        }

        // 결과 구성 (PHP와 동일 포맷: { [targetId]: ReactionItem[] })
        const result: Record<string, ReturnType<typeof parseReaction>[]> = {};
        for (const row of reactions) {
            if (!result[row.target_id]) {
                result[row.target_id] = [];
            }
            const isChosen = chooseMap.get(row.target_id)?.has(row.reaction) ?? false;
            result[row.target_id].push(parseReaction(row.reaction, row.reaction_count, isChosen));
        }

        return json({ status: 'success', result });
    } catch (error) {
        console.error('Reaction GET error:', error);
        return json({ status: 'error', message: '리액션 조회에 실패했습니다.' }, { status: 500 });
    }
};

/**
 * POST - 리액션 추가/토글
 * body: { reaction, targetId, parentId, reactionMode? }
 * reactionMode: 'add' (항상 추가), 'toggle' (있으면 제거, 없으면 추가), default (있으면 제거)
 */
export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ status: 'error', message: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { reaction, targetId, parentId, reactionMode = 'add' } = body;

        if (!reaction || !targetId) {
            return json(
                { status: 'error', message: 'reaction과 targetId가 필요합니다.' },
                { status: 400 }
            );
        }

        // 유효성 검사
        const safeReaction = sanitizeId(reaction);
        const safeTargetId = sanitizeId(targetId);
        const safeParentId = parentId ? sanitizeId(parentId) : safeTargetId;

        if (safeReaction.length > 250 || safeTargetId.length > 250) {
            return json({ status: 'error', message: 'ID가 너무 깁니다.' }, { status: 400 });
        }

        if (!VALID_REACTION_PATTERN.test(safeReaction)) {
            return json(
                { status: 'error', message: '유효하지 않은 리액션입니다.' },
                { status: 400 }
            );
        }

        // 작성자 리액션 방지 (PHP preventWriterReaction과 동일: wr_is_comment=1로 댓글만 체크)
        const targetParts = safeTargetId.split(':');
        if (targetParts.length >= 3) {
            const boardTable = targetParts[1].replace(/[^a-zA-Z0-9_]/g, '');
            const wrId = targetParts[2];

            try {
                const [authorRows] = await pool.query<RowDataPacket[]>(
                    `SELECT mb_id FROM g5_write_${boardTable}
					 WHERE wr_id = ? AND wr_is_comment = 1`,
                    [wrId]
                );
                if (authorRows[0]?.mb_id === user.mb_id) {
                    return json(
                        { status: 'error', message: '자신의 글에 리액션을 할 수 없습니다.' },
                        { status: 403 }
                    );
                }
            } catch {
                // 테이블이 없으면 무시 (content 타입 등)
            }
        }

        // 리액션 개수 제한 (add 모드, 비관리자)
        if (reactionMode === 'add' && (user.mb_level ?? 0) < 10) {
            const [countRows] = await pool.query<CountRow[]>(
                `SELECT COUNT(*) AS reactionRows FROM g5_da_reaction
				 WHERE target_id = ?`,
                [safeTargetId]
            );
            if ((countRows[0]?.reactionRows ?? 0) >= REACTION_LIMIT) {
                // 이미 선택한 리액션이면 허용
                const [chooseRows] = await pool.query<ChooseCountRow[]>(
                    `SELECT COUNT(*) AS count FROM g5_da_reaction_choose
					 WHERE member_id = ? AND target_id = ? AND reaction = ?`,
                    [user.mb_id, safeTargetId, safeReaction]
                );
                if ((chooseRows[0]?.count ?? 0) === 0) {
                    return json(
                        {
                            status: 'error',
                            message: `리액션은 최대 ${REACTION_LIMIT}개까지 가능합니다.`
                        },
                        { status: 400 }
                    );
                }
            }
        }

        // 기존 리액션 확인
        const [existing] = await pool.query<RowDataPacket[]>(
            `SELECT reaction FROM g5_da_reaction_choose
			 WHERE member_id = ? AND target_id = ? AND reaction = ?`,
            [user.mb_id, safeTargetId, safeReaction]
        );

        // 클라이언트 IP (PHP chosen_ip 호환)
        let clientIp = '';
        try {
            clientIp = getClientAddress();
        } catch {
            // IP 가져오기 실패 시 빈 문자열
        }

        if (!existing[0]) {
            // 리액션 추가
            await addReaction(user.mb_id, safeReaction, safeTargetId, safeParentId, clientIp);
        } else if (reactionMode !== 'add') {
            // 리액션 취소 (add 모드가 아닐 때만)
            await revokeReaction(user.mb_id, safeReaction, safeTargetId);
        }

        // 업데이트된 리액션 반환
        const [updatedReactions] = await pool.query<ReactionRow[]>(
            `SELECT target_id, reaction, reaction_count FROM g5_da_reaction
			 WHERE target_id = ? ORDER BY id ASC`,
            [safeTargetId]
        );

        const [updatedChoices] = await pool.query<ChooseRow[]>(
            `SELECT target_id, reaction FROM g5_da_reaction_choose
			 WHERE member_id = ? AND target_id = ?`,
            [user.mb_id, safeTargetId]
        );

        const chosenSet = new Set(updatedChoices.map((r) => r.reaction));
        const result: Record<string, ReturnType<typeof parseReaction>[]> = {
            [safeTargetId]: updatedReactions.map((r) =>
                parseReaction(r.reaction, r.reaction_count, chosenSet.has(r.reaction))
            )
        };

        return json({ status: 'success', result });
    } catch (error) {
        console.error('Reaction POST error:', error);
        return json({ status: 'error', message: '리액션 처리에 실패했습니다.' }, { status: 500 });
    }
};

/** PHP addReaction과 동일: 트랜잭션 + chosen_ip 기록 */
async function addReaction(
    memberId: string,
    reaction: string,
    targetId: string,
    parentId: string,
    clientIp: string
): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 개별 선택 로그 추가 (chosen_ip 포함 — PHP 호환)
        await conn.query(
            `INSERT INTO g5_da_reaction_choose
			 (member_id, reaction, target_id, parent_id, created_at, chosen_ip)
			 VALUES (?, ?, ?, ?, NOW(), ?)`,
            [memberId, reaction, targetId, parentId, clientIp || null]
        );

        // 집계 카운트 증가 (UPSERT — PHP와 동일 쿼리)
        await conn.query(
            `INSERT INTO g5_da_reaction
			 (reaction, target_id, parent_id, reaction_count)
			 VALUES (?, ?, ?, 1)
			 ON DUPLICATE KEY UPDATE reaction_count = reaction_count + 1`,
            [reaction, targetId, parentId]
        );

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/** PHP revokeReaction과 동일 로직 + 트랜잭션 추가 (정합성 강화) */
async function revokeReaction(memberId: string, reaction: string, targetId: string): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 개별 선택 삭제
        await conn.query(
            `DELETE FROM g5_da_reaction_choose
			 WHERE member_id = ? AND target_id = ? AND reaction = ?`,
            [memberId, targetId, reaction]
        );

        // 집계 카운트 감소
        await conn.query(
            `UPDATE g5_da_reaction
			 SET reaction_count = reaction_count - 1
			 WHERE target_id = ? AND reaction = ?`,
            [targetId, reaction]
        );

        // 카운트 0 이하면 삭제 (PHP와 동일)
        const [countRows] = await conn.query<RowDataPacket[]>(
            `SELECT reaction_count FROM g5_da_reaction
			 WHERE target_id = ? AND reaction = ?`,
            [targetId, reaction]
        );
        if (countRows[0] && countRows[0].reaction_count <= 0) {
            await conn.query(
                `DELETE FROM g5_da_reaction
				 WHERE target_id = ? AND reaction = ? AND reaction_count <= 0`,
                [targetId, reaction]
            );
        }

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
