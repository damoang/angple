/**
 * 댓글 목록 부가 조회(리뷰 별점·럭키 배지)를 해당되는 경우에만 하도록 거르는 게이트.
 *
 * - 리뷰 별점: 게시판 설정 `features.rating` 이 켜진 게시판에서만 평점 조회.
 *   평점 쓰기 자체가 그 설정이 켜진 게시판에서만 허용된다.
 * - 럭키 배지: 댓글 대상 럭키 지급은 지급 원장(`g5_da_lucky_grant`)에 항상 함께 남는다
 *   (원장 INSERT 와 포인트·경험치 INSERT 가 한 트랜잭션). 원장에 있는 댓글만 포인트·경험치 조회.
 *
 * 두 게이트 모두 프로세스 캐시(짧은 TTL)를 쓰고, 조회가 실패하면 **예전처럼 조회하도록**
 * 열어 둔다(fail-open) — 배지·별점이 빠지는 것보다 쿼리 한 번이 낫다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { createCache } from '$lib/server/cache';
import { boardHasRatingFeature } from '$lib/server/rating-aspects.js';

/** 게시판 rating 설정 캐시 TTL — 설정은 거의 바뀌지 않는다. */
export const RATING_GATE_TTL_MS = 60_000;
/** 게시판별 럭키 원장 대상 id 캐시 TTL — 새 지급의 배지 표시는 최대 이만큼 늦을 수 있다. */
export const LUCKY_LEDGER_TTL_MS = 60_000;

const ratingCache = createCache<boolean>({ ttl: RATING_GATE_TTL_MS, maxSize: 500 });
const luckyLedgerCache = createCache<Set<number>>({ ttl: LUCKY_LEDGER_TTL_MS, maxSize: 500 });

/**
 * 이 게시판 댓글의 리뷰 별점을 조회해야 하는가.
 * 설정 조회 실패 → true(예전처럼 조회).
 */
export async function shouldLookupReviewRatings(boardId: string): Promise<boolean> {
    try {
        return await ratingCache.getOrSet(boardId, () => boardHasRatingFeature(boardId));
    } catch (e) {
        console.warn('[review-rating] rating 설정 조회 실패 — 평점 조회 유지:', e);
        return true;
    }
}

/**
 * 게시판의 럭키 지급 원장 대상 wr_id 집합.
 *
 * 종류(kind) 로 거르지 않는다 — 같은 게시판 표에서 wr_id 는 글·댓글 통틀어 유일하므로
 * 글 대상 id 가 섞여도 댓글 id 와의 교집합 결과는 같다(집합만 조금 커진다).
 */
async function loadLuckyLedgerIds(boardId: string): Promise<Set<number>> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT source_id FROM g5_da_lucky_grant WHERE source_table = ?`,
        [boardId]
    );
    const ids = new Set<number>();
    for (const r of rows) {
        const id = Number(r.source_id);
        if (Number.isInteger(id) && id > 0) ids.add(id);
    }
    return ids;
}

/**
 * 이번 요청의 댓글 id 중 럭키 포인트·경험치를 조회할 id 목록.
 * 원장 조회 실패 → 댓글 id 전체(예전처럼 전체 조회).
 */
export async function luckyLookupCommentIds(
    boardId: string,
    commentIds: number[]
): Promise<number[]> {
    if (commentIds.length === 0) return [];
    let ledger: Set<number>;
    try {
        ledger = await luckyLedgerCache.getOrSet(boardId, () => loadLuckyLedgerIds(boardId));
    } catch (e) {
        console.warn('[lucky] 지급 원장 조회 실패 — 전체 조회 유지:', e);
        return commentIds;
    }
    if (ledger.size === 0) return [];
    return commentIds.filter((id) => ledger.has(id));
}

/** 테스트 전용: 캐시 초기화. */
export function _resetCommentEnrichGateCaches(): void {
    ratingCache.clear();
    luckyLedgerCache.clear();
}
