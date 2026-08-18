/**
 * GET /api/boards/[boardId]/posts/[postId]/page-index
 *
 * 해당 글이 자유게시판 등에서 N페이지에 위치하는지 계산.
 * RecentPosts (글 상세 하단 목록) 가 URL `?page` 없이 진입했을 때
 * 자기 글이 속한 페이지로 자동 이동하기 위한 endpoint (#12430).
 *
 * 페이지 계산: 더 최신 (wr_id 가 더 큰) 정상 글 개수 / page_rows + 1.
 *   - prior = COUNT(wr_id > targetId, wr_is_comment=0, wr_deleted_at IS NULL)
 *   - page  = floor(prior / page_rows) + 1
 *
 * page_rows 는 g5_board.bo_page_rows (게시판 설정), 미설정 시 25 default.
 *
 * ## ⛔ 이 endpoint 는 DB 실행시간의 58% 를 쓰고 있었다 (2026-08-18 실측)
 *
 * `[boardId]/[postId]/+page.server.ts` 가 SSR 에서 **await 로 블로킹 호출**한다.
 * 즉 `?page` 없는 글 조회 **한 번마다 한 번씩** 불린다.
 *
 *   호출 3,150만회 · 누적 1,812,104초 · 호출당 평균 99,305행 스캔
 *   → DB 전체 누적 실행시간 3,149,562초의 **57.5%**
 *   (가동 시간보다 누적 실행시간이 커서 CPU 1코어 이상을 상시 점유)
 *
 * 비용의 정체는 `COUNT(wr_id > X)` 가 **X 가 오래된 글일수록 비싸다**는 것이다.
 * 인덱스는 이미 최적이다(`idx_comment_deleted` + InnoDB 인덱스 확장으로 wr_id 까지 커버,
 * `Using index`). 스캔하는 행 수 자체가 답의 크기라 인덱스로는 더 줄일 수 없다.
 *
 * ## 그래서 캐시한다 — 적중률이 실측으로 96% 다
 *
 * 같은 글 URL 이 반복 조회되기 때문이다(ClickHouse `aplog.ad_events`, 2일치):
 *
 *   글 상세 페이지뷰 3,545,380 / 고유 URL 138,775 = **URL 당 25.55회**
 *   → 이론 적중률 96.1%
 *
 * ⛔ 캐시하는 값은 `page` 가 아니라 **`prior`** 다. page 는 게시판 설정
 *    (`bo_page_rows`)에 의존하므로, 설정이 바뀌면 캐시된 page 는 틀린 값이 된다.
 *    prior 를 캐시하고 page 는 매번 현재 설정으로 계산한다.
 *
 * ⛔ TTL 을 하나로 고정하지 마라. 깊이에 따라 정확도 요구가 다르다.
 *    - 최신 글: prior 가 작아 **쿼리도 싸다**. 새 글 24개마다 페이지가 바뀌므로 짧게.
 *    - 오래된 글: 쿼리가 비싸고, 몇천 페이지 중 1페이지 어긋나는 것은 무의미하다. 길게.
 *    비싼 쪽일수록 오래 캐시된다 = 비용이 큰 요청일수록 캐시가 잘 듣는다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import type { RowDataPacket } from 'mysql2';

const BOARD_ID_RE = /^[a-zA-Z0-9_]{1,40}$/;

/** 게시판 설정(page_rows)은 거의 안 바뀐다. 길게 캐시해도 안전하다. */
const PAGE_ROWS_TTL_SEC = 600;

/**
 * prior 깊이별 TTL. 위 주석의 "비싼 쪽일수록 길게" 원칙을 표로 옮긴 것.
 * 경계값은 `prior` 기준이며 위에서부터 처음 걸리는 항목을 쓴다.
 */
const PRIOR_TTL_TIERS: ReadonlyArray<{ maxPrior: number; ttlSec: number }> = [
    { maxPrior: 1_000, ttlSec: 60 }, // 1~40 페이지 — 사람이 실제로 오가는 구간
    { maxPrior: 10_000, ttlSec: 600 }, // ~400 페이지
    { maxPrior: Number.POSITIVE_INFINITY, ttlSec: 3_600 } // 그 이상 — 사실상 아카이브
];

function ttlForPrior(prior: number): number {
    return PRIOR_TTL_TIERS.find((t) => prior < t.maxPrior)?.ttlSec ?? 3_600;
}

export const GET: RequestHandler = async ({ params, setHeaders }) => {
    const boardId = params.boardId ?? '';
    const postId = parseInt(params.postId ?? '0', 10);

    if (!BOARD_ID_RE.test(boardId) || !Number.isFinite(postId) || postId <= 0) {
        return json({ page: 1, page_rows: 25 }, { status: 400 });
    }

    try {
        const pageRows = await getPageRows(boardId);
        const prior = await getPrior(boardId, postId);
        const page = Math.floor(prior / pageRows) + 1;

        // 짧은 캐시 (1분) — 페이지 번호가 자주 바뀌지 않음
        setHeaders({ 'Cache-Control': 'public, max-age=60' });

        return json({ page, page_rows: pageRows, prior });
    } catch (err) {
        // DB 오류 시 1페이지 fallback (사용자 흐름 방해 X)
        console.error('[page-index] DB error:', err);
        return json({ page: 1, page_rows: 25 });
    }
};

/** 게시판 page_rows. Redis 실패는 무시하고 DB 로 간다. */
async function getPageRows(boardId: string): Promise<number> {
    const key = `pi:rows:${boardId}`;
    try {
        const hit = await getRedis().get(key);
        if (hit !== null) return Math.max(1, parseInt(hit, 10) || 25);
    } catch {
        // Redis 장애 시 DB fallback
    }

    const [boardRows] = await pool.query<RowDataPacket[]>(
        'SELECT bo_page_rows FROM g5_board WHERE bo_table = ? LIMIT 1',
        [boardId]
    );
    const pageRows = Math.max(1, (boardRows[0]?.bo_page_rows as number | null) ?? 25);

    try {
        await getRedis().setex(key, PAGE_ROWS_TTL_SEC, String(pageRows));
    } catch {
        // Redis 장애 무시
    }
    return pageRows;
}

/**
 * 이 글보다 최신인 정상 글 개수.
 * ⛔ 여기가 비용의 전부다. 캐시 miss 일 때만 DB 를 친다.
 */
async function getPrior(boardId: string, postId: number): Promise<number> {
    const key = `pi:prior:${boardId}:${postId}`;
    try {
        const hit = await getRedis().get(key);
        if (hit !== null) {
            const cached = parseInt(hit, 10);
            if (Number.isFinite(cached) && cached >= 0) return cached;
        }
    } catch {
        // Redis 장애 시 DB fallback
    }

    // 해당 글보다 최신인 정상 글 개수 (1페이지에 최신 글이 옴)
    const tableName = `g5_write_${boardId}`;
    const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM \`${tableName}\`
         WHERE wr_is_comment = 0 AND wr_id > ? AND wr_deleted_at IS NULL`,
        [postId]
    );
    const prior = (countRows[0]?.c as number) ?? 0;

    try {
        await getRedis().setex(key, ttlForPrior(prior), String(prior));
    } catch {
        // Redis 장애 무시
    }
    return prior;
}
