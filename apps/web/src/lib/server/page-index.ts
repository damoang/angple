/**
 * 글이 목록의 몇 페이지에 있는지 계산 (#12430)
 *
 * 글 상세 하단의 최근글 목록이 `?page` 없이 진입했을 때, 자기 글이 속한 페이지로
 * 자동 이동하기 위해 쓴다.
 *
 *   prior = COUNT(wr_id > targetId, wr_is_comment=0, wr_deleted_at IS NULL)
 *   page  = floor(prior / page_rows) + 1
 *
 * ## ⛔ 왜 라우트가 아니라 여기 있는가
 *
 * 이 계산의 **호출자는 100% SSR** 이다. 2026-08-18 실측:
 * 운영 파드 nginx 사이드카 로그 3,000줄에서 브라우저 API 2,230건(좋아요 233·댓글 154) 중
 * `page-index` 요청은 **0건**이었다. `[boardId]/[postId]/+page.server.ts` 가 부르는 게 전부다.
 *
 * 그런데 SSR 이 `svelteKitFetch('/api/.../page-index')` 로 **자기 자신을 HTTP 로** 부르고 있었다.
 * 같은 프로세스라 네트워크는 없지만 Request/Response 생성과 JSON 직렬화·역직렬화가 매 요청 일어난다.
 * 캐시 적중인데도 1~3ms 가 걸린 이유다(Redis GET 하나면 1ms 미만이어야 한다).
 *
 * → 로직을 여기로 빼고 **라우트와 SSR 이 같은 함수를 쓴다.** 결과는 완전히 동일하고 계층만 사라진다.
 * ⭐ 요청당 객체 할당이 줄어드는 것은 **2026-08-07 web heap OOM** 이력이 있는 이 서비스에 부수 이득이다.
 *
 * ⛔ 공개 라우트(`/api/boards/.../page-index`)는 **지우지 마라.**
 *    `recent-posts.svelte` 에 폴백 호출이 남아 있다(SSR 이 1페이지를 준 경우에만 발화).
 *
 * ## 캐시 설계 (2026-08-18, DB 실행시간 57.5% 구간)
 *
 * 캐시 전 실측: 호출 3,150만회 · 누적 1,812,104초 · 호출당 평균 99,305행 스캔.
 * 인덱스로는 못 줄인다 — `idx_comment_deleted` + InnoDB 인덱스 확장으로 이미 커버링 범위 스캔이고
 * `COUNT(wr_id > X)` 는 **스캔 행수 자체가 답의 크기**다.
 *
 * ⛔ `page` 가 아니라 **`prior` 를 캐시한다.** `page` 는 `bo_page_rows` 에 의존하므로
 *    게시판 설정이 바뀌면 캐시된 page 가 틀린 값이 된다.
 * ⛔ TTL 을 하나로 고정하지 마라. 최신 글은 쿼리도 싸고 페이지가 자주 바뀌므로 짧게,
 *    아카이브 글은 비싸고 1페이지 오차가 무의미하므로 길게. **비싼 요청일수록 오래 캐시된다.**
 */
import pool from '$lib/server/db';
import { getRedis } from '$lib/server/redis';
import type { RowDataPacket } from 'mysql2';

/** 게시판 설정(page_rows)은 거의 안 바뀐다. 길게 캐시해도 안전하다. */
const PAGE_ROWS_TTL_SEC = 600;

/** `bo_page_rows` 미설정 시 기본값. 라우트의 400 응답과도 같은 값을 쓴다. */
export const DEFAULT_PAGE_ROWS = 25;

export const BOARD_ID_RE = /^[a-zA-Z0-9_]{1,40}$/;

/**
 * prior 깊이별 TTL. 위 주석의 "비싼 쪽일수록 길게" 원칙을 표로 옮긴 것.
 * 위에서부터 처음 걸리는 항목을 쓴다.
 */
const PRIOR_TTL_TIERS: ReadonlyArray<{ maxPrior: number; ttlSec: number }> = [
    { maxPrior: 1_000, ttlSec: 60 }, // 1~40 페이지 — 사람이 실제로 오가는 구간
    { maxPrior: 10_000, ttlSec: 600 }, // ~400 페이지
    { maxPrior: Number.POSITIVE_INFINITY, ttlSec: 3_600 } // 그 이상 — 사실상 아카이브
];

function ttlForPrior(prior: number): number {
    return PRIOR_TTL_TIERS.find((t) => prior < t.maxPrior)?.ttlSec ?? 3_600;
}

export interface PageIndexResult {
    page: number;
    page_rows: number;
    prior: number;
}

/**
 * 글의 페이지 번호.
 *
 * ⛔ 던지지 않는다. 이 값은 **하단 목록을 어느 페이지로 열지**를 정할 뿐이라,
 *    실패했다고 글 상세 렌더가 막히면 안 된다. 실패 시 1페이지로 떨어진다(기존 동작).
 */
export async function getPageIndex(boardId: string, postId: number): Promise<PageIndexResult> {
    if (!BOARD_ID_RE.test(boardId) || !Number.isFinite(postId) || postId <= 0) {
        return { page: 1, page_rows: DEFAULT_PAGE_ROWS, prior: 0 };
    }

    try {
        const pageRows = await getPageRows(boardId);
        const prior = await getPrior(boardId, postId);
        return { page: Math.floor(prior / pageRows) + 1, page_rows: pageRows, prior };
    } catch (err) {
        console.error('[page-index] 계산 실패:', err);
        return { page: 1, page_rows: DEFAULT_PAGE_ROWS, prior: 0 };
    }
}

/** 게시판 page_rows. Redis 실패는 무시하고 DB 로 간다. */
async function getPageRows(boardId: string): Promise<number> {
    const key = `pi:rows:${boardId}`;
    try {
        const hit = await getRedis().get(key);
        if (hit !== null) return Math.max(1, parseInt(hit, 10) || DEFAULT_PAGE_ROWS);
    } catch {
        // Redis 장애 시 DB fallback
    }

    const [boardRows] = await pool.query<RowDataPacket[]>(
        'SELECT bo_page_rows FROM g5_board WHERE bo_table = ? LIMIT 1',
        [boardId]
    );
    const pageRows = Math.max(
        1,
        (boardRows[0]?.bo_page_rows as number | null) ?? DEFAULT_PAGE_ROWS
    );

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
