/**
 * 새글 모아보기 (g5_board_new 테이블)
 * PHP /bbs/new.php 호환
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { TieredCache } from '$lib/server/cache.js';
import { findDisciplinedIds, DISCIPLINED_TITLE } from '$lib/server/discipline-mask.js';

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

/**
 * 범위 프리셋 화이트리스트.
 *
 * ⛔ 여기에 없는 값은 `''` 로 강등된다(`feed/+page.server.ts`). 열린 집합으로 두면 크롤러가
 *    던지는 임의 문자열마다 캐시 키·CDN 엔트리가 생겨 원본 부하가 증폭된다.
 * ⭐ 이 Set 을 비우면 쿼리 코드를 건드리지 않고 서버측 기능이 꺼진다(킬스위치).
 */
export const FEED_SCOPE_PRESETS = new Set(['', 'nofree']);

/**
 * 새글모음을 지배하는 보드. 실측(2026-08-01): 7일 83,323건 중 `free` 가 89.8%.
 * 사이트 특수 사실이라 상수로 격리한다 — 쿼리 로직에 흩뿌리지 않는다.
 */
const MAJOR_BOARD = 'free';

// --- 캐시 ---

/**
 * 새글 결과 캐시: L1 30초, L2 60초 (새글이 빈번하므로 짧게)
 *
 * ⛔ 네임스페이스가 'feed2' 인 이유: 삭제글을 거르면서 **같은 키의 내용이 바뀌었다.**
 *    구 'feed' 엔트리가 살아 있으면 배포 직후 삭제글이 그대로 나온다. 구키는 TTL 로 소멸한다.
 * maxSize 는 scope 만큼 키가 늘어나므로 200 → 400.
 */
const feedCache = new TieredCache<NewPostsResult>('feed2', 30_000, 60, 400);

/** COUNT(*) 캐시: key = "view:grId:scope", TTL 10분 */
const countCache = new Map<string, { total: number; expiry: number }>();
const COUNT_CACHE_TTL = 10 * 60 * 1000; // 10분

/** 그룹 목록 캐시: TTL 1시간 */
let boardGroupsCache: { data: { gr_id: string; gr_subject: string }[]; expiry: number } | null =
    null;
const BOARD_GROUPS_CACHE_TTL = 60 * 60 * 1000; // 1시간

/** 검색 노출 보드 → 그룹 매핑 캐시: TTL 10분 (보드 신설이 프리셋에 반영되는 지연 상한) */
let searchableBoardsCache: { data: { bo_table: string; gr_id: string }[]; expiry: number } | null =
    null;
const SEARCHABLE_BOARDS_CACHE_TTL = 10 * 60 * 1000; // 10분

async function getSearchableBoards(): Promise<{ bo_table: string; gr_id: string }[]> {
    if (searchableBoardsCache && Date.now() < searchableBoardsCache.expiry) {
        return searchableBoardsCache.data;
    }
    const [rows] = await readPool.query<RowDataPacket[]>(
        'SELECT bo_table, gr_id FROM g5_board WHERE bo_use_search = 1'
    );
    const data = rows as { bo_table: string; gr_id: string }[];
    searchableBoardsCache = { data, expiry: Date.now() + SEARCHABLE_BOARDS_CACHE_TTL };
    return data;
}

/** WHERE 절 조립 결과. 보드 교집합이 비면 `empty` — 쿼리를 아예 쏘지 않는다. */
type FeedParam = string | number | string[];

interface FeedWhere {
    conditions: string[];
    /** `IN (?)` 에는 배열이 통째로 하나의 파라미터로 들어간다 (mysql2 가 펼친다) */
    params: FeedParam[];
    empty: boolean;
}

/**
 * 목록·COUNT 가 **같은 WHERE 를 쓰도록** 한 곳에서 만든다.
 *
 * ⛔ 예전에는 두 곳에 복붙돼 있었다. 조건을 하나 추가할 때 한쪽만 고치면
 *    "목록엔 안 보이는데 건수는 그대로" 같은 어긋남이 조용히 생긴다.
 *
 * ⭐ 그룹 필터를 `b.gr_id = ?` 로 걸지 않고 보드 목록으로 풀어 `bn.bo_table IN (...)` 으로 거는
 *    이유: `g5_board.gr_id` 에 인덱스가 없어 JOIN 조건으로 걸면 드라이빙 테이블이 `b` 로
 *    뒤집히며 **임시테이블 + 파일소트**가 된다(EXPLAIN 실측). `bn.bo_table` 술어는
 *    백워드 PK 스캔을 유지한다.
 */
async function buildFeedWhere(opts: {
    view: string;
    grId: string;
    scope: string;
    cursor?: number;
}): Promise<FeedWhere> {
    const conditions: string[] = [
        'b.bo_use_search = 1',
        'bn.bn_datetime > DATE_SUB(NOW(), INTERVAL 7 DAY)'
    ];
    const params: FeedParam[] = [];

    if (opts.view === 'w') {
        conditions.push('bn.wr_id = bn.wr_parent');
    } else if (opts.view === 'c') {
        conditions.push('bn.wr_id != bn.wr_parent');
    }

    const excludeMajor = opts.scope === 'nofree';

    if (opts.grId) {
        // 그룹 + 범위를 **교집합 하나**로 계산한다 — 둘의 우선순위 규칙이 필요 없어진다.
        const boards = (await getSearchableBoards())
            .filter((b) => b.gr_id === opts.grId)
            .map((b) => b.bo_table)
            .filter((t) => /^[a-zA-Z0-9_]+$/.test(t)) // 기존 조립부와 같은 검증
            .filter((t) => !excludeMajor || t !== MAJOR_BOARD);

        // ⛔ 빈 배열을 IN 에 넣으면 `IN (NULL)` 이 되어 조용히 0건이 된다. 명시적으로 끊는다.
        if (boards.length === 0) {
            return { conditions, params, empty: true };
        }
        conditions.push('bn.bo_table IN (?)');
        params.push(boards);
    } else if (excludeMajor) {
        // 단일 제외는 `<>` 가 가장 싸다 — 기준(필터 없음)과 같은 실행계획이 나온다.
        conditions.push('bn.bo_table <> ?');
        params.push(MAJOR_BOARD);
    }

    if (opts.cursor && opts.cursor > 0) {
        conditions.push('bn.bn_id < ?');
        params.push(opts.cursor);
    }

    return { conditions, params, empty: false };
}

/**
 * 소프트 삭제 판정. 판정식은 `routes/api/search/+server.ts:125-131` 선례를 그대로 따른다
 * (`0000-00-00` 와 빈 문자열까지 살아있는 글로 본다).
 */
function isDeleted(deletedAt: unknown): boolean {
    return (
        deletedAt !== null &&
        deletedAt !== undefined &&
        String(deletedAt) !== '0000-00-00 00:00:00' &&
        String(deletedAt) !== ''
    );
}

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
    sort: FeedSort = 'latest',
    scope: string = ''
): Promise<NewPostsResult> {
    // Redis 2-tier 캐시 확인 (L1 30초, L2 60초)
    // ⛔ scope 를 키에 넣지 않으면 L2(전 사용자 공유)에서 「전체」와 「자유게시판 제외」 결과가
    //    서로에게 샌다. 아래 COUNT 키도 마찬가지 — **두 곳 다** 넣어야 한다.
    const feedCacheKey = `${view}:${grId}:${scope}:${page}:${cursor || 0}:${sort}`;
    const cached = await feedCache.get(feedCacheKey);
    if (cached) return cached;

    // 최신순일 때만 커서 기반 페이지네이션 사용
    const listWhere = await buildFeedWhere({
        view,
        grId,
        scope,
        cursor: sort === 'latest' ? cursor : undefined
    });
    if (listWhere.empty) {
        return { items: [], total: 0, nextCursor: null };
    }
    const params = listWhere.params;
    const whereClause = 'WHERE ' + listWhere.conditions.join(' AND ');

    // COUNT(*) — 캐시 우선 (커서 무관, 필터 기준)
    const cacheKey = `${view}:${grId}:${scope}`;
    const cachedCount = countCache.get(cacheKey);
    let total: number;
    if (cachedCount && Date.now() < cachedCount.expiry) {
        total = cachedCount.total;
    } else {
        // 커서 조건만 뺀 같은 WHERE 로 카운트 (빌더 공유 — 목록과 어긋날 수 없다)
        const countWhereParts = await buildFeedWhere({ view, grId, scope });
        const countWhere = 'WHERE ' + countWhereParts.conditions.join(' AND ');

        const [countRows] = await readPool.query<RowDataPacket[]>(
            `SELECT COUNT(*) as total
			 FROM g5_board_new bn
			 JOIN g5_board b ON bn.bo_table = b.bo_table
			 ${countWhere}`,
            countWhereParts.params
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
    // 이용제한 근거 글: 피드에서도 제목·본문 치환(#12908).
    const disciplinedSet = new Set<string>(); // key: "bo_table:wr_id"

    const batchPromises = Array.from(grouped.entries()).map(async ([boTable, tableRows]) => {
        const wrIds = tableRows.map((r) => r.wr_id);
        try {
            const [writeRows] = await readPool.query<RowDataPacket[]>(
                `SELECT wr_id, wr_subject, wr_content, wr_name, wr_comment, wr_hit, wr_deleted_at
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
        const disciplined = await findDisciplinedIds(boTable, wrIds);
        for (const id of disciplined) disciplinedSet.add(`${boTable}:${id}`);
    });

    await Promise.all(batchPromises);

    // 결과 조립 (원래 순서 유지)
    let items: NewPostItem[] = [];
    for (const row of rows) {
        const writeData = writeDataMap.get(`${row.bo_table}:${row.wr_id}`);
        if (writeData) {
            // 삭제글은 목록에서 뺀다. `g5_board_new` 는 소프트 삭제 때 정리되지 않아
            // (실측: 최근 7일 삭제 1,385건 중 1,027건 잔존) 여기서 걸러야 제목·작성자가 안 샌다.
            // 원본 행이 아예 없는 경우를 이미 조용히 건너뛰고 있으므로(위 if) 그 동작과 일관된다.
            if (isDeleted(writeData.wr_deleted_at)) continue;

            const isDisciplined = disciplinedSet.has(`${row.bo_table}:${row.wr_id}`);
            items.push({
                bn_id: row.bn_id,
                bo_table: row.bo_table,
                wr_id: row.wr_id,
                wr_parent: row.wr_parent,
                bn_datetime: row.bn_datetime,
                bo_subject: row.bo_subject,
                wr_subject: isDisciplined ? DISCIPLINED_TITLE : writeData.wr_subject,
                wr_content: isDisciplined ? '' : extractContentPreview(writeData.wr_content || ''),
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

    // 다음 페이지 커서: **조회된 원본 행**의 마지막 bn_id.
    //
    // ⛔ items 를 쓰면 안 된다. 한 페이지가 전부 걸러지는 경우(삭제글만 있는 구간) items 가
    //    비어 nextCursor 가 null 이 되고, 뒤에 남은 글이 있는데도 **다음 페이지가 막힌다.**
    //    삭제 필터를 넣으면서 그 확률이 올라갔으므로 함께 고친다.
    //    `rows.length === perPage` 는 마지막 페이지 판정까지 겸한다.
    const nextCursor =
        sort === 'latest' && rows.length === perPage ? rows[rows.length - 1].bn_id : null;

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

    // ⛔ 예전에는 `g5_group` 전량을 반환해 드롭다운에 **글이 0건인 그룹**(운영용·휴지통·
    //    unused·audit·nerv·beta)까지 전부 떴다. 고를 수는 있는데 고르면 빈 목록이 나오는
    //    선택지다. 새글모음이 다루는 범위(검색 노출 보드 + 최근 7일)와 같은 기준으로 맞춘다.
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT g.gr_id, g.gr_subject
		   FROM g5_group g
		  WHERE EXISTS (
		        SELECT 1 FROM g5_board b
		         WHERE b.gr_id = g.gr_id AND b.bo_use_search = 1
		           AND EXISTS (
		               SELECT 1 FROM g5_board_new bn
		                WHERE bn.bo_table = b.bo_table
		                  AND bn.bn_datetime > DATE_SUB(NOW(), INTERVAL 7 DAY)
		           )
		  )
		  ORDER BY g.gr_order, g.gr_id`
    );
    const data = rows as { gr_id: string; gr_subject: string }[];
    boardGroupsCache = { data, expiry: Date.now() + BOARD_GROUPS_CACHE_TTL };
    return data;
}
