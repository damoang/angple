/**
 * 자동 연결된 앙티티 태그 해제 — 글 작성자 본인만.
 *
 * 왜 필요한가: 시스템이 사용자 글에 메타데이터를 붙이는 이상, 되돌리기 경로가 반드시 있어야 한다.
 * 자동 태깅이 "정확도 개선"이 아니라 "기능 삭제"로 수습된 사례(Google Photos)의 원인이
 * 되돌리기 불가였다. 여기서는 오탐의 최대 피해가 "작성자 클릭 1회"로 상한된다.
 *
 * 이 해제 기록은 킬 스위치(isAutoLinkSuspended)의 입력이기도 하다 —
 * 해제율이 임계를 넘으면 자동 부착 자체가 중단된다. 해제 경로와 킬 스위치는 한 쌍이다.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { ANGTT_TAG } from '$lib/server/angtt-dictionary-logic';

/** 자동 부착 태그의 작성자 표기 — 사람이 단 태그는 건드리지 않는다 */
const SYSTEM_TAG_MB_ID = 'ai';

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = locals.user?.id;
    if (!userId) throw error(401, '로그인이 필요합니다.');

    let body: { boardId?: string; wrId?: number };
    try {
        body = await request.json();
    } catch {
        throw error(400, '잘못된 요청입니다.');
    }

    const boardId = String(body.boardId ?? '');
    const wrId = Number(body.wrId ?? 0);
    if (!/^[a-zA-Z0-9_-]+$/.test(boardId) || !Number.isInteger(wrId) || wrId <= 0) {
        throw error(400, '잘못된 요청입니다.');
    }

    // 작성자 본인 확인 — 이 라우트는 Go 백엔드를 거치지 않으므로 직접 검증한다.
    const [ownerRows] = await pool.query(`SELECT mb_id FROM ?? WHERE wr_id = ? LIMIT 1`, [
        `g5_write_${boardId}`,
        wrId
    ]);
    const owner = (ownerRows as { mb_id?: string }[])[0]?.mb_id;
    if (!owner) throw error(404, '글을 찾을 수 없습니다.');
    if (owner !== userId) throw error(403, '본인 글만 해제할 수 있습니다.');

    // 자동 부착된 링크만 대상 — 사람이 만든 링크(review/mention)는 보존
    const [linkRows] = await pool.query(
        `SELECT entity_id FROM angple_entity_posts
          WHERE bo_table = ? AND wr_id = ? AND role = 'auto'`,
        [boardId, wrId]
    );
    const links = linkRows as { entity_id: number }[];
    if (links.length === 0) throw error(404, '자동 연결된 작품이 없습니다.');

    const [slugRows] = await pool.query(`SELECT slug FROM angple_entities WHERE id IN (?)`, [
        links.map((l) => l.entity_id)
    ]);
    const slugs = (slugRows as { slug: string }[]).map((r) => r.slug);

    // 시스템(ai)이 단 태그만 삭제. 작성자가 직접 단 동일 태그는 남긴다.
    await pool.query(
        `DELETE FROM g5_na_tag_log
          WHERE bo_table = ? AND wr_id = ? AND mb_id = ? AND tag IN (?)`,
        [boardId, wrId, SYSTEM_TAG_MB_ID, [ANGTT_TAG, ...slugs]]
    );

    await pool.query(
        `DELETE FROM angple_entity_posts
          WHERE bo_table = ? AND wr_id = ? AND role = 'auto'`,
        [boardId, wrId]
    );

    // 태그 카운트 재계산
    await pool.query(
        `UPDATE g5_na_tag t
            SET t.cnt = (SELECT COUNT(*) FROM g5_na_tag_log l WHERE l.tag_id = t.id)
          WHERE t.tag IN (?)`,
        [[ANGTT_TAG, ...slugs]]
    );

    return json({ success: true, unlinked: slugs });
};
