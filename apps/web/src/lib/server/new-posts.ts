/**
 * 새글 모아보기 (g5_board_new 테이블)
 * PHP /bbs/new.php 호환
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { TieredCache } from '$lib/server/cache.js';

export interface NewPostItem {
    bn_id: number;
    bo_table: string;
    wr_id: number;
    wr_parent: number;
    bn_datetime: string;
    bo_subject: string;
    wr_subject: string;
    wr_content: string; // 댓글 미리보기용
    mb_id: string;
    wr_name: string;
    wr_comment: number;
    wr_hit: number;
}

export type FeedSort = 'latest' | 'comments' | 'views';

export interface NewPostsResult {
    items: NewPostItem[];
    total: number;
    /** 다음 페이지 커서 (마지막 항목의 bn_id) */
    nextCursor: number | null;
}

// --- 캐시 ---

/** 새글 결과 캐시: L1 30초, L2 60초 (새글이 빈번하므로 짧게) */
const feedCache = new TieredCache<NewPostsResult>('feed', 30_000, 60, 200);

/** COUNT(*) 캐시: key = "view:grId", TTL 10분 */
const countCache = new Map<string, { total: number; expiry: number }>();
const COUNT_CACHE_TTL = 10 * 60 * 1000; // 10분

/** 그룹 목록 캐시: TTL 1시간 */
let boardGroupsCache: { data: { gr_id: string; gr_subject: string }[]; expiry: number } | null =
    null;
const BOARD_GROUPS_CACHE_TTL = 60 * 60 * 1000; // 1시간

/** HTML 태그, 이모지 코드 제거 및 미리보기 추출 */
function extractContentPreview(rawContent: string, maxLen = 100): string {
    const entityMap: Record<string, string> = {
        '&nbsp;': ' ',
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&'
    };
    let stripped = rawContent;
    let prev;
    do {
        prev = stripped;
        stripped = stripped.replace(/<[^>]*>/g, '');
    } while (stripped !== prev);
    const plainText = stripped
        .replace(/\{emo:[^}]+\}/g, '') // 이모지 코드 {emo:xxx} 제거
        .replace(/&(?:nbsp|lt|gt|amp);/g, (m) => entityMap[m])
        .replace(/\s+/g, ' ')
        .trim();
    return plainText.length > maxLen ? plainText.slice(0, maxLen) : plainText;
}

/**
 * 새글 목록 조회
 * @param view - 'w' 원글만, 'c' 댓글만, '' 전체
 * @param grId - 그룹 필터 (optional)
 * @param page - 페이지 번호
 * @param perPage - 페이지당 항목 수
 * @param cursor - 커서 (이전 페이지 마지막 bn_id, OFFSET 대신 사용)
 */
export async function getNewPosts(
    view: string,
    grId: string,
    page: number,
    perPage: number = 30,
    cursor?: number,
    sort: FeedSort = 'latest'
): Promise<NewPostsResult> {
    // Redis 2-tier 캐시 확인 (L1 30초, L2 60초)
    const feedCacheKey = `${view}:${grId}:${page}:${cursor || 0}:${sort}`;
    const cached = await feedCache.get(feedCacheKey);
    if (cached) return cached;

    const conditions: string[] = [
        'b.bo_use_search = 1',
        'bn.bn_datetime > DATE_SUB(NOW(), INTERVAL 7 DAY)'
    ];
    const params: (string | number)[] = [];

    // 원글/댓글 필터
    if (view === 'w') {
        conditions.push('bn.wr_id = bn.wr_parent');
    } else if (view === 'c') {
        conditions.push('bn.wr_id != bn.wr_parent');
    }

    // 그룹 필터
    if (grId) {
        conditions.push('b.gr_id = ?');
        params.push(grId);
    }

    // 최신순일 때만 커서 기반 페이지네이션 사용
    if (sort === 'latest' && cursor && cursor > 0) {
        conditions.push('bn.bn_id < ?');
        params.push(cursor);
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    // COUNT(*) — 캐시 우선 (커서 무관, 필터 기준)
    const cacheKey = `${view}:${grId}`;
    const cachedCount = countCache.get(cacheKey);
    let total: number;
    if (cachedCount && Date.now() < cachedCount.expiry) {
        total = cachedCount.total;
    } else {
        // 커서 조건 제외한 원본 WHERE로 카운트
        const countConditions: string[] = [
            'b.bo_use_search = 1',
            'bn.bn_datetime > DATE_SUB(NOW(), INTERVAL 7 DAY)'
        ];
        const countParams: (string | number)[] = [];
        if (view === 'w') countConditions.push('bn.wr_id = bn.wr_parent');
        else if (view === 'c') countConditions.push('bn.wr_id != bn.wr_parent');
        if (grId) {
            countConditions.push('b.gr_id = ?');
            countParams.push(grId);
        }
        const countWhere = 'WHERE ' + countConditions.join(' AND ');

        const [countRows] = await readPool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total
			 FROM g5_board_new bn
			 JOIN g5_board b ON bn.bo_table = b.bo_table
			 ${countWhere}`,
            countParams
        );
        total = countRows[0]?.total || 0;
        countCache.set(cacheKey, { total, expiry: Date.now() + COUNT_CACHE_TTL });
    }

    // 게시글 목록 조회
    // 최신순은 기존 커서 기반, 그 외 정렬은 최근 후보군을 넓게 조회 후 서버에서 정렬
    const useCursor = sort === 'latest' && cursor && cursor > 0;
    const useCandidatePool = sort !== 'latest';
    const offset = (page - 1) * perPage;
    const candidateLimit = Math.min(Math.max(page * perPage + 120, 240), 1000);
    const listParams = useCandidatePool
        ? [...params, candidateLimit]
        : useCursor
          ? [...params, perPage]
          : [...params, offset, perPage];

    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT bn.bn_id, bn.bo_table, bn.wr_id, bn.wr_parent, bn.bn_datetime,
		        b.bo_subject, bn.mb_id
		 FROM g5_board_new bn
		 JOIN g5_board b ON bn.bo_table = b.bo_table
		 ${whereClause}
		 ORDER BY bn.bn_id DESC
		 LIMIT ${useCandidatePool || useCursor ? '?' : '?, ?'}`,
        listParams
    );

    if (rows.length === 0) {
        return { items: [], total, nextCursor: null };
    }

    // --- 테이블별 배치 IN 쿼리 (N+1 해결) ---
    // rows를 bo_table 기준으로 그룹핑
    const grouped = new Map<string, RowDataPacket[]>();
    for (const row of rows) {
        // 테이블명 안전성 검증 (영문+숫자+언더스코어만 허용)
        if (!/^[a-zA-Z0-9_]+$/.test(row.bo_table)) continue;
        const existing = grouped.get(row.bo_table);
        if (existing) {
            existing.push(row);
        } else {
            grouped.set(row.bo_table, [row]);
        }
    }

    // 테이블별 병렬 배치 쿼리 실행
    const writeDataMap = new Map<string, RowDataPacket>(); // key: "bo_table:wr_id"

    const batchPromises = Array.from(grouped.entries()).map(async ([boTable, tableRows]) => {
        const wrIds = tableRows.map((r) => r.wr_id);
        try {
            const [writeRows] = await readPool.query<RowDataPacket[]>(
                `SELECT wr_id, wr_subject, wr_content, wr_name, wr_comment, wr_hit
				 FROM \`g5_write_${boTable}\`
				 WHERE wr_id IN (?)`,
                [wrIds]
            );
            for (const wr of writeRows) {
                writeDataMap.set(`${boTable}:${wr.wr_id}`, wr);
            }
        } catch {
            // 삭제된 게시판 등 오류 무시
        }
    });

    await Promise.all(batchPromises);

    // 결과 조립 (원래 순서 유지)
    let items: NewPostItem[] = [];
    for (const row of rows) {
        const writeData = writeDataMap.get(`${row.bo_table}:${row.wr_id}`);
        if (writeData) {
            items.push({
                bn_id: row.bn_id,
                bo_table: row.bo_table,
                wr_id: row.wr_id,
                wr_parent: row.wr_parent,
                bn_datetime: row.bn_datetime,
                bo_subject: row.bo_subject,
                wr_subject: writeData.wr_subject,
                wr_content: extractContentPreview(writeData.wr_content || ''),
                mb_id: row.mb_id,
                wr_name: writeData.wr_name,
                wr_comment: writeData.wr_comment,
                wr_hit: writeData.wr_hit
            });
        }
    }

    if (sort === 'comments') {
        items.sort(
            (a, b) =>
                b.wr_comment - a.wr_comment ||
                new Date(b.bn_datetime).getTime() - new Date(a.bn_datetime).getTime()
        );
    } else if (sort === 'views') {
        items.sort(
            (a, b) =>
                b.wr_hit - a.wr_hit ||
                new Date(b.bn_datetime).getTime() - new Date(a.bn_datetime).getTime()
        );
    }

    if (useCandidatePool) {
        items = items.slice(offset, offset + perPage);
    }

    // 다음 페이지 커서: 마지막 항목의 bn_id
    const nextCursor = sort === 'latest' && items.length > 0 ? items[items.length - 1].bn_id : null;

    const result: NewPostsResult = { items, total, nextCursor };

    // 결과 캐시 저장 (fire-and-forget)
    feedCache.set(feedCacheKey, result).catch(() => {});

    return result;
}

/** 그룹 목록 조회 (1시간 인메모리 캐시) */
export async function getBoardGroups(): Promise<{ gr_id: string; gr_subject: string }[]> {
    if (boardGroupsCache && Date.now() < boardGroupsCache.expiry) {
        return boardGroupsCache.data;
    }

    const [rows] = await readPool.query<RowDataPacket[]>(
        'SELECT gr_id, gr_subject FROM g5_group ORDER BY gr_order, gr_id'
    );
    const data = rows as { gr_id: string; gr_subject: string }[];
    boardGroupsCache = { data, expiry: Date.now() + BOARD_GROUPS_CACHE_TTL };
    return data;
}
