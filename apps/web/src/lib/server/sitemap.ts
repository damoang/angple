/**
 * 사이트맵 공용 로직 (SSR 전용).
 *
 * 게시글 sitemap 을 전 게시판(bo_use_search=1) 실제 글 수 기준으로 40,000개씩
 * 페이지 분할한다. index(sitemap.xml)와 각 페이지(sitemap-posts-N.xml)가 이
 * 매니페스트를 공유해 페이지 수·경계가 항상 일치한다.
 *
 * 이전 구조의 문제: index 가 보드 30개만 카운트(LIMIT 30)해 posts-1 하나만 등재했고,
 * 페이지 핸들러는 보드당 2000개(POSTS_PER_BOARD)로 캡을 걸어 대형 게시판(자유게시판
 * 71만 글) 대부분이 어떤 sitemap 에도 포함되지 않았다. → 실제 글 수 기반 일관 페이징.
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { TieredCache } from '$lib/server/cache.js';

export const SITEMAP_POSTS_PER_PAGE = 40000; // Google 권장 최대 50,000 이하
const SAFE_TABLE = /^[a-zA-Z0-9_]+$/;

export interface BoardPostCount {
    board: string;
    count: number;
}

// 게시판별 글 수(COUNT)는 무거우므로 길게 캐시(L1 6h, L2 6h). sitemap 은 크롤러용이라
// 몇 시간 지연은 무방하고, 대형 테이블 COUNT 반복을 피한다.
const boardCountCache = new TieredCache<BoardPostCount[]>(
    'sitemap-board-counts',
    6 * 60 * 60 * 1000,
    6 * 60 * 60,
    1
);

/** bo_use_search=1 전 게시판의 실제 글 수(wr_is_comment=0). 캐시. */
export async function getSitemapBoardCounts(): Promise<BoardPostCount[]> {
    return boardCountCache.getOrFetch('all', async () => {
        const [boards] = await pool.query<RowDataPacket[]>(
            'SELECT bo_table FROM g5_board WHERE bo_use_search = 1 ORDER BY bo_order'
        );
        const result: BoardPostCount[] = [];
        for (const b of boards as Array<{ bo_table: string }>) {
            const board = b.bo_table;
            if (!SAFE_TABLE.test(board)) continue;
            try {
                const [rows] = await pool.query<RowDataPacket[]>(
                    `SELECT COUNT(*) AS cnt FROM g5_write_${board} WHERE wr_is_comment = 0`
                );
                const count = Number((rows[0] as { cnt: number }).cnt) || 0;
                if (count > 0) result.push({ board, count });
            } catch {
                // 없는 테이블 등은 건너뛴다.
            }
        }
        return result;
    });
}

export interface SitemapSegment {
    board: string;
    offset: number;
    limit: number;
}

/**
 * 게시판 카운트를 PAGE_SIZE 단위로 이어붙여 페이지별 세그먼트 매니페스트를 만든다.
 * pages[p-1] = 페이지 p(1-based)가 담을 (board, offset, limit) 목록.
 * 한 보드가 PAGE_SIZE 를 넘으면 여러 세그먼트/페이지로 나뉜다.
 */
export function buildSitemapManifest(
    counts: BoardPostCount[],
    pageSize: number = SITEMAP_POSTS_PER_PAGE
): SitemapSegment[][] {
    const pages: SitemapSegment[][] = [];
    let current: SitemapSegment[] = [];
    let fill = 0;
    for (const { board, count } of counts) {
        let boardOffset = 0;
        let remaining = count;
        while (remaining > 0) {
            const take = Math.min(pageSize - fill, remaining);
            current.push({ board, offset: boardOffset, limit: take });
            fill += take;
            boardOffset += take;
            remaining -= take;
            if (fill >= pageSize) {
                pages.push(current);
                current = [];
                fill = 0;
            }
        }
    }
    if (current.length > 0) pages.push(current);
    return pages.length > 0 ? pages : [[]];
}

/** 게시글 sitemap 총 페이지 수(최소 1). */
export async function getSitemapPageCount(): Promise<number> {
    const counts = await getSitemapBoardCounts();
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    return Math.max(1, Math.ceil(total / SITEMAP_POSTS_PER_PAGE));
}

/** 특정 페이지(1-based)의 세그먼트 목록. 범위 밖이면 빈 배열. */
export async function getSitemapPageSegments(pageNum: number): Promise<SitemapSegment[]> {
    const counts = await getSitemapBoardCounts();
    const pages = buildSitemapManifest(counts);
    return pages[pageNum - 1] ?? [];
}
