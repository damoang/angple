/**
 * 사이트맵 공용 로직 (SSR 전용).
 *
 * 게시글 sitemap 을 검색 사용·비회원 공개 게시판(bo_use_search=1, 목록·읽기 레벨 1) 실제 글 수 기준으로 40,000개씩
 * 페이지 분할한다. index(sitemap.xml)와 각 페이지(sitemap-posts-N.xml)가 이
 * 매니페스트를 공유해 페이지 수·경계가 항상 일치한다.
 *
 * 이전 구조의 문제: index 가 보드 30개만 카운트(LIMIT 30)해 posts-1 하나만 등재했고,
 * 페이지 핸들러는 보드당 2000개(POSTS_PER_BOARD)로 캡을 걸어 대형 게시판(자유게시판
 * 71만 글) 대부분이 어떤 sitemap 에도 포함되지 않았다. → 실제 글 수 기반 일관 페이징.
 *
 * 깊은 페이지: 세그먼트를 `LIMIT ? OFFSET ?` 로 읽으면 앞의 행을 전부 읽고 버려
 * 뒤 페이지일수록 느려진다. 그래서 매니페스트를 만들 때 각 세그먼트의 시작 직전 글
 * 번호(커서)를 함께 구해 캐시하고, 페이지는 `wr_id < 커서 ... LIMIT ?` 로 읽는다.
 * 커서는 페이지 쿼리와 같은 조건(삭제글 제외)·같은 순서로 센 순번이라, 같은 시점의
 * OFFSET 결과와 페이지 내용이 같다. 커서를 못 구한 세그먼트는 OFFSET 으로 읽는다.
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { TieredCache } from '$lib/server/cache.js';

export const SITEMAP_POSTS_PER_PAGE = 40000; // Google 권장 최대 50,000 이하
const SAFE_TABLE = /^[a-zA-Z0-9_]+$/;

/** 페이지 쿼리와 커서 계산이 공유하는 「sitemap 에 싣는 글」 조건. */
export const SITEMAP_POST_WHERE =
    "wr_is_comment = 0 AND (wr_deleted_at IS NULL OR wr_deleted_at = '0000-00-00 00:00:00')";

/** 커서 계산 쿼리 상한. 넘기면 그 게시판은 커서 없이(OFFSET) 동작한다. */
const CURSOR_QUERY_MAX_MS = 8000;

export interface BoardPostCount {
    board: string;
    count: number;
}

/**
 * 게시판별 세그먼트 커서. cursors[board][offset] = 그 게시판에서 offset 번째(1부터)
 * 글의 wr_id. offset 위치부터 시작하는 세그먼트는 `wr_id < 커서` 로 읽는다.
 * 값 0 = 그 위치에 글이 없다(삭제글을 빼면 offset 보다 글이 적다) → 세그먼트는 비어 있다.
 */
export type SitemapCursors = Record<string, Record<string, number>>;

interface SitemapSnapshot {
    counts: BoardPostCount[];
    cursors: SitemapCursors;
}

// 게시판별 글 수(COUNT)와 커서는 무거우므로 길게 캐시(L1 6h, L2 6h). sitemap 은
// 크롤러용이라 몇 시간 지연은 무방하고, 대형 테이블 COUNT 반복을 피한다.
// 글 수와 커서는 한 스냅샷으로 함께 저장한다 — 따로 캐시하면 서로 다른 시점의 값이
// 섞여 페이지 경계가 어긋난다. (값 모양이 바뀌어 키 이름에 v2 를 붙였다.)
const snapshotCache = new TieredCache<SitemapSnapshot>(
    'sitemap-board-counts-v2',
    6 * 60 * 60 * 1000,
    6 * 60 * 60,
    1
);

async function fetchBoardCounts(): Promise<BoardPostCount[]> {
    const [boards] = await pool.query<RowDataPacket[]>(
        'SELECT bo_table FROM g5_board WHERE bo_use_search = 1 AND bo_list_level <= 1 AND bo_read_level <= 1 ORDER BY bo_order'
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
}

/**
 * 한 게시판에서 주어진 순번(1부터, wr_id 내림차순, 삭제글 제외) 글의 wr_id 를 구한다.
 * 페이지 쿼리와 같은 조건·순서로 세므로 커서 직후 행 = 같은 OFFSET 의 첫 행이다.
 * 삭제글 판정 컬럼까지 담은 커버링 인덱스로 읽혀 본 행을 조회하지 않는다.
 * 없는 순번은 0 으로 채운다. 실패하면 예외를 그대로 던진다(호출부가 폴백).
 */
export async function fetchBoardCursors(
    board: string,
    offsets: number[]
): Promise<Record<string, number>> {
    if (!SAFE_TABLE.test(board)) throw new Error(`unsafe board: ${board}`);
    const cursors: Record<string, number> = {};
    if (offsets.length === 0) return cursors;
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT /*+ MAX_EXECUTION_TIME(${CURSOR_QUERY_MAX_MS}) */ wr_id, rn
         FROM (
             SELECT wr_id, ROW_NUMBER() OVER (ORDER BY wr_id DESC) AS rn
             FROM g5_write_${board}
             WHERE ${SITEMAP_POST_WHERE}
         ) ranked
         WHERE rn IN (?)`,
        [offsets]
    );
    const byRank = new Map<number, number>();
    for (const r of rows as Array<{ wr_id: number; rn: number }>) {
        byRank.set(Number(r.rn), Number(r.wr_id));
    }
    for (const offset of offsets) cursors[String(offset)] = byRank.get(offset) ?? 0;
    return cursors;
}

/** 매니페스트에서 커서가 필요한 (게시판 → offset>0 목록) 을 모은다. */
export function collectCursorOffsets(pages: SitemapSegment[][]): Map<string, number[]> {
    const needed = new Map<string, number[]>();
    for (const page of pages) {
        for (const seg of page) {
            if (seg.offset <= 0) continue;
            const list = needed.get(seg.board) ?? [];
            list.push(seg.offset);
            needed.set(seg.board, list);
        }
    }
    return needed;
}

async function fetchSnapshot(): Promise<SitemapSnapshot> {
    const counts = await fetchBoardCounts();
    const cursors: SitemapCursors = {};
    for (const [board, offsets] of collectCursorOffsets(buildSitemapManifest(counts))) {
        try {
            cursors[board] = await fetchBoardCursors(board, offsets);
        } catch (err) {
            // 커서가 없으면 그 게시판은 OFFSET 으로 읽는다(예전과 같은 결과·비용).
            console.error('[Sitemap] 커서 계산 실패:', board, err);
        }
    }
    return { counts, cursors };
}

function getSnapshot(): Promise<SitemapSnapshot> {
    return snapshotCache.getOrFetch('all', fetchSnapshot);
}

/** 검색 사용·비회원 공개 게시판의 실제 글 수(wr_is_comment=0). 캐시. */
export async function getSitemapBoardCounts(): Promise<BoardPostCount[]> {
    return (await getSnapshot()).counts;
}

export interface SitemapSegment {
    board: string;
    offset: number;
    limit: number;
    /** 있으면 `wr_id < cursor` 로 읽는다(0 = 빈 세그먼트). 없으면 OFFSET 폴백. */
    cursor?: number;
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

/**
 * 세그먼트에 커서를 붙인다. offset 0 은 커서가 필요 없고(처음부터 읽는다),
 * 커서가 없는 세그먼트는 그대로 둬 OFFSET 으로 읽게 한다.
 */
export function attachCursors(
    segments: SitemapSegment[],
    cursors: SitemapCursors
): SitemapSegment[] {
    return segments.map((seg) => {
        if (seg.offset <= 0) return seg;
        const cursor = cursors[seg.board]?.[String(seg.offset)];
        return typeof cursor === 'number' && Number.isFinite(cursor) ? { ...seg, cursor } : seg;
    });
}

/**
 * 세그먼트를 읽는 쿼리의 페이징 부분(WHERE 추가 조건·LIMIT 절)과 바인딩 값.
 * 커서가 있으면 키셋(`wr_id < ?`), 없으면 기존 OFFSET.
 */
export function segmentPaging(seg: SitemapSegment): {
    where: string;
    limit: string;
    params: number[];
} {
    if (seg.offset > 0 && typeof seg.cursor === 'number') {
        return { where: ' AND wr_id < ?', limit: 'LIMIT ?', params: [seg.cursor, seg.limit] };
    }
    return { where: '', limit: 'LIMIT ? OFFSET ?', params: [seg.limit, seg.offset] };
}

/** 게시글 sitemap 총 페이지 수(최소 1). */
export async function getSitemapPageCount(): Promise<number> {
    const counts = await getSitemapBoardCounts();
    const total = counts.reduce((sum, c) => sum + c.count, 0);
    return Math.max(1, Math.ceil(total / SITEMAP_POSTS_PER_PAGE));
}

/** 특정 페이지(1-based)의 세그먼트 목록(커서 포함). 범위 밖이면 빈 배열. */
export async function getSitemapPageSegments(pageNum: number): Promise<SitemapSegment[]> {
    const { counts, cursors } = await getSnapshot();
    const pages = buildSitemapManifest(counts);
    return attachCursors(pages[pageNum - 1] ?? [], cursors);
}
