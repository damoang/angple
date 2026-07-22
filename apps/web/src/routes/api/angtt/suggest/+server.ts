/**
 * 앙티티 크라우드 제안 API — 독자가 미연결 글을 작품에 연결 제안한다.
 *
 * POST   제안 등록: 로그인 + 앙님💛(mb_level 3) 이상, free/angtt 글 한정.
 *        서로 다른 회원 PROMOTE_THRESHOLD(2)명이 같은 작품을 제안하면
 *        angple_entity_posts 에 role='mention' INSERT IGNORE 로 자동 승격
 *        (7/22 라이브된 태그→링크와 동일 경로 — read 경로 무접촉).
 * DELETE 본인 표 철회. 승격 후에는 링크는 유지되고 표만 삭제된다(해제는 관리자).
 *
 * 남용 방어:
 *  - 1인 1표: angple_entity_post_suggestions PK(bo_table, wr_id, entity_id, mb_id)로
 *    스키마가 강제 — 중복 제안은 ER_DUP_ENTRY 를 삼켜 멱등 200 처리.
 *  - 레이트리밋: 회원당 24시간 10건 (idx_member_recent 인덱스 시크).
 *  - 정확일치만: 제안 대상은 실존 active entity slug — 자유텍스트 제안 없음.
 *
 * 등급은 g5_member 를 직접 조회한다 — 세션 캐시(user_basic)의 stale 등급으로
 * 게이트가 어긋나지 않게 쓰기 시점 실측값을 쓴다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { getEntityBySlug } from '$plugins/angtt-review/lib/entities.server';
import {
    DAILY_SUGGEST_LIMIT,
    SUGGEST_MIN_LEVEL,
    isSuggestableBoard,
    shouldPromote
} from '$lib/components/features/board/angtt-suggest-logic.js';
import { buildGradeDeniedMessage } from '$lib/utils/board-permissions.js';

interface SuggestTarget {
    boardId: string;
    wrId: number;
    slug: string;
}

/** body {boardId, wrId, slug} 공통 검증 — 실패 시 null */
async function parseTarget(request: Request): Promise<SuggestTarget | null> {
    let body: { boardId?: unknown; wrId?: unknown; slug?: unknown };
    try {
        body = await request.json();
    } catch {
        return null;
    }
    const boardId = String(body.boardId ?? '');
    const wrId = Number(body.wrId ?? 0);
    const slug = String(body.slug ?? '').trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(boardId)) return null;
    if (!Number.isInteger(wrId) || wrId <= 0) return null;
    if (!slug || slug.length > 160) return null;
    return { boardId, wrId, slug };
}

/** 이 글·작품 쌍의 서로 다른 제안자 수 (PK 프리픽스 시크) */
async function countDistinctVoters(target: SuggestTarget, entityId: number): Promise<number> {
    const [rows] = await pool.query(
        `SELECT COUNT(DISTINCT mb_id) AS voters
           FROM angple_entity_post_suggestions
          WHERE bo_table = ? AND wr_id = ? AND entity_id = ?`,
        [target.boardId, target.wrId, entityId]
    );
    return Number((rows as { voters?: number }[])[0]?.voters ?? 0);
}

export const POST: RequestHandler = async ({ request, locals, setHeaders }) => {
    setHeaders({ 'Cache-Control': 'private, no-store' });

    const mbId = locals.user?.id;
    if (!mbId) {
        return json({ error: '연결을 제안하려면 로그인이 필요해요.' }, { status: 401 });
    }

    const target = await parseTarget(request);
    if (!target) return json({ error: '잘못된 요청입니다.' }, { status: 400 });
    if (!isSuggestableBoard(target.boardId)) {
        return json({ error: '이 게시판 글에는 연결을 제안할 수 없어요.' }, { status: 400 });
    }

    // 등급 게이트 — 별점(RATING_MIN_LEVEL)과 동일 기준. 쓰기 시점 실측값(g5_member).
    const [levelRows] = await pool.query(`SELECT mb_level FROM g5_member WHERE mb_id = ? LIMIT 1`, [
        mbId
    ]);
    const level = Number((levelRows as { mb_level?: number }[])[0]?.mb_level ?? 0);
    if (level < SUGGEST_MIN_LEVEL) {
        return json(
            { error: buildGradeDeniedMessage('연결 제안', SUGGEST_MIN_LEVEL, level) },
            { status: 403 }
        );
    }

    // 글 존재 확인 — 삭제글·댓글 거부 (동적 테이블, boardId 는 위에서 화이트리스트 검증됨)
    const [postRows] = await pool.query(
        `SELECT wr_id FROM ??
          WHERE wr_id = ? AND wr_is_comment = 0 AND wr_deleted_at IS NULL LIMIT 1`,
        [`g5_write_${target.boardId}`, target.wrId]
    );
    if ((postRows as unknown[]).length === 0) {
        return json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 제안 대상은 실존 active 작품만 — 자유텍스트 제안 원천 차단
    const entity = await getEntityBySlug(target.slug);
    if (!entity || entity.status !== 'active') {
        return json({ error: '작품을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 이미 연결된 글(any role)에는 제안 불가 — 카드도 이 경우 버튼을 노출하지 않는다
    const [linkRows] = await pool.query(
        `SELECT 1 FROM angple_entity_posts WHERE bo_table = ? AND wr_id = ? LIMIT 1`,
        [target.boardId, target.wrId]
    );
    if ((linkRows as unknown[]).length > 0) {
        return json({ error: '이미 작품에 연결된 글이에요.' }, { status: 409 });
    }

    // 레이트리밋 — 회원당 24시간 DAILY_SUGGEST_LIMIT 건 (idx_member_recent 시크)
    const [rateRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM angple_entity_post_suggestions
          WHERE mb_id = ? AND created_at >= NOW(3) - INTERVAL 1 DAY`,
        [mbId]
    );
    const recent = Number((rateRows as { cnt?: number }[])[0]?.cnt ?? 0);
    if (recent >= DAILY_SUGGEST_LIMIT) {
        return json(
            { error: '하루에 제안할 수 있는 횟수를 넘었어요. 내일 다시 시도해 주세요.' },
            { status: 429 }
        );
    }

    // 1표 등록 — PK 중복(이미 제안)은 멱등 200 으로 수렴
    try {
        await pool.execute(
            `INSERT INTO angple_entity_post_suggestions
                (bo_table, wr_id, entity_id, mb_id, created_at)
             VALUES (?, ?, ?, ?, NOW(3))`,
            [target.boardId, target.wrId, entity.id, mbId]
        );
    } catch (e) {
        if ((e as { code?: string }).code !== 'ER_DUP_ENTRY') throw e;
    }

    // 승격 판정 — 서로 다른 회원 수가 임계에 닿으면 링크 확정.
    // INSERT IGNORE 멱등이라 동시 요청·재시도에도 링크는 정확히 1행이다(별도 트랜잭션 불요).
    const voters = await countDistinctVoters(target, entity.id);
    let promoted = false;
    if (shouldPromote(voters)) {
        await pool.execute(
            `INSERT IGNORE INTO angple_entity_posts (entity_id, bo_table, wr_id, role, created_at)
             VALUES (?, ?, ?, 'mention', NOW(3))`,
            [entity.id, target.boardId, target.wrId]
        );
        promoted = true;
    }

    return json({ count: voters, promoted, myVote: true });
};

export const DELETE: RequestHandler = async ({ request, locals, setHeaders }) => {
    setHeaders({ 'Cache-Control': 'private, no-store' });

    const mbId = locals.user?.id;
    if (!mbId) {
        return json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const target = await parseTarget(request);
    if (!target) return json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const entity = await getEntityBySlug(target.slug);
    if (!entity) return json({ error: '작품을 찾을 수 없습니다.' }, { status: 404 });

    // 본인 표만 삭제. 승격 후에는 entity_posts 링크는 유지된다(해제는 관리자 몫).
    await pool.execute(
        `DELETE FROM angple_entity_post_suggestions
          WHERE bo_table = ? AND wr_id = ? AND entity_id = ? AND mb_id = ?`,
        [target.boardId, target.wrId, entity.id, mbId]
    );

    const voters = await countDistinctVoters(target, entity.id);
    return json({ count: voters, promoted: false, myVote: false });
};
