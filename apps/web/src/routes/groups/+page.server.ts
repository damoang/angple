/**
 * 소모임 전체 목록 페이지 서버
 * DB에서 group_id='group'인 게시판 목록을 조회합니다.
 */
import type { PageServerLoad } from './$types';
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { TieredCache } from '$lib/server/cache.js';
import { fetchPostDetails, type GroupLatestPost } from './groups-data.js';

export type { GroupLatestPost };

export interface GroupBoard {
    bo_table: string;
    board_path: string;
    bo_subject: string;
    bo_count_write: number;
    bo_count_comment: number;
    today_count: number;
    weekly_count: number;
    subscriber_count: number;
}

/** 소모임 목록 캐시: L1 10분, L2(Redis) 30분 */
const groupBoardsCache = new TieredCache<GroupBoard[]>('group-boards', 600_000, 1800, 1);

/** 소모임 최근글 캐시: L1 3분, L2(Redis) 5분 */
const groupLatestCache = new TieredCache<GroupLatestPost[]>('group-latest', 180_000, 300, 1);

/** 소모임 최근글 카운트 캐시: L1 3분, L2(Redis) 5분 */
const groupLatestCountCache = new TieredCache<number>('group-latest-count', 180_000, 300, 1);

const LATEST_LIMIT = 20;

/** 소모임 추천글 캐시: L1 5분, L2(Redis) 15분 */
const groupPopularCache = new TieredCache<GroupLatestPost[]>('group-popular', 300_000, 900, 1);

export const load: PageServerLoad = async () => {
    const cacheKey = 'all';

    const [boardsResult, latestResult, popularResult, totalResult] = await Promise.allSettled([
        loadGroupBoards(cacheKey),
        loadLatestPosts(),
        loadPopularPosts(),
        loadLatestCount()
    ]);

    if (boardsResult.status === 'rejected') {
        console.error('[groups] boards 로딩 에러:', boardsResult.reason);
    }
    if (latestResult.status === 'rejected') {
        console.error('[groups] latest 로딩 에러:', latestResult.reason);
    }
    if (popularResult.status === 'rejected') {
        console.error('[groups] popular 로딩 에러:', popularResult.reason);
    }
    if (totalResult.status === 'rejected') {
        console.error('[groups] total 로딩 에러:', totalResult.reason);
    }

    const boards = boardsResult.status === 'fulfilled' ? boardsResult.value : [];
    const latestPosts = latestResult.status === 'fulfilled' ? latestResult.value : [];
    const popularPosts = popularResult.status === 'fulfilled' ? popularResult.value : [];
    const latestTotal = totalResult.status === 'fulfilled' ? totalResult.value : latestPosts.length;

    return {
        boards,
        latestPosts,
        popularPosts,
        latestTotal,
        latestHasMore: latestTotal > LATEST_LIMIT
    };
};

async function loadGroupBoards(cacheKey: string): Promise<GroupBoard[]> {
    const cached = await groupBoardsCache.get(cacheKey);
    if (cached) return cached;

    let boards: GroupBoard[];
    try {
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT b.bo_table, b.bo_subject, b.bo_count_write, b.bo_count_comment,
                    IFNULL(n.cnt, 0) AS today_count,
                    IFNULL(w.cnt, 0) AS weekly_count,
                    IFNULL(s.cnt, 0) AS subscriber_count
    		 FROM g5_board b
    		 LEFT JOIN (
    		     SELECT bo_table, COUNT(*) AS cnt
    		     FROM g5_board_new
    		     WHERE bn_datetime >= CURDATE()
    		     GROUP BY bo_table
    		 ) n ON n.bo_table = b.bo_table
    		 LEFT JOIN (
    		     SELECT bo_table, COUNT(*) AS cnt
    		     FROM g5_board_new
    		     WHERE bn_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    		     GROUP BY bo_table
    		 ) w ON w.bo_table = b.bo_table
    		 LEFT JOIN (
    		     SELECT bo_table, COUNT(*) AS cnt
    		     FROM g5_board_subscribe
    		     GROUP BY bo_table
    		 ) s ON s.bo_table = b.bo_table
    		 WHERE b.gr_id = 'group'
    		 ORDER BY b.bo_order, b.bo_table`
        );
        boards = rows as GroupBoard[];
    } catch (err) {
        console.warn('[groups] subscriber_count 쿼리 실패, fallback 사용:', err);
        const [fallbackRows] = await readPool.query<RowDataPacket[]>(
            `SELECT b.bo_table, b.bo_subject, b.bo_count_write, b.bo_count_comment,
                    IFNULL(n.cnt, 0) AS today_count,
                    IFNULL(w.cnt, 0) AS weekly_count,
                    0 AS subscriber_count
    		 FROM g5_board b
    		 LEFT JOIN (
    		     SELECT bo_table, COUNT(*) AS cnt
    		     FROM g5_board_new
    		     WHERE bn_datetime >= CURDATE()
    		     GROUP BY bo_table
    		 ) n ON n.bo_table = b.bo_table
    		 LEFT JOIN (
    		     SELECT bo_table, COUNT(*) AS cnt
    		     FROM g5_board_new
    		     WHERE bn_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    		     GROUP BY bo_table
    		 ) w ON w.bo_table = b.bo_table
    		 WHERE b.gr_id = 'group'
    		 ORDER BY b.bo_order, b.bo_table`
        );
        boards = fallbackRows as GroupBoard[];
    }

    const normalizedBoards = boards.map((board) => ({
        ...board,
        // 소모임 링크는 소문자 경로로 통일하고 라우트에서 canonical redirect 처리한다.
        board_path: board.bo_table.toLowerCase()
    }));

    await groupBoardsCache.set(cacheKey, normalizedBoards);
    return normalizedBoards;
}

async function loadLatestPosts(): Promise<GroupLatestPost[]> {
    const cached = await groupLatestCache.get('latest');
    if (cached) return cached;

    const [refs] = await readPool.query<RowDataPacket[]>(
        `SELECT n.bo_table, b.bo_subject, n.wr_id, n.mb_id,
                IFNULL(m.mb_nick, n.mb_id) AS mb_nick,
                n.bn_datetime
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 LEFT JOIN g5_member m ON m.mb_id = n.mb_id
		 WHERE n.wr_parent = n.wr_id
		 ORDER BY n.bn_datetime DESC
		 LIMIT ${LATEST_LIMIT}`
    );

    const posts = await fetchPostDetails(
        refs.map((r) => ({
            bo_table: r.bo_table as string,
            bo_subject: r.bo_subject as string,
            wr_id: r.wr_id as number,
            mb_id: r.mb_nick as string,
            bn_datetime: r.bn_datetime as string
        }))
    );

    posts.sort((a, b) => new Date(b.wr_datetime).getTime() - new Date(a.wr_datetime).getTime());

    const nickMap = new Map<string, string>();
    for (const r of refs) {
        nickMap.set(`${r.bo_table}-${r.wr_id}`, r.mb_nick as string);
    }
    for (const p of posts) {
        p.mb_nick = nickMap.get(`${p.bo_table}-${p.wr_id}`) || p.mb_id;
    }

    const normalizedPosts = posts.map((post) => ({
        ...post,
        bo_table: post.bo_table.toLowerCase()
    }));

    await groupLatestCache.set('latest', normalizedPosts);
    return normalizedPosts;
}

async function loadPopularPosts(): Promise<GroupLatestPost[]> {
    const cached = await groupPopularCache.get('popular');
    if (cached) return cached;

    const [refs] = await readPool.query<RowDataPacket[]>(
        `SELECT n.bo_table, b.bo_subject, n.wr_id, n.mb_id,
                IFNULL(m.mb_nick, n.mb_id) AS mb_nick,
                n.bn_datetime
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 LEFT JOIN g5_member m ON m.mb_id = n.mb_id
		 WHERE n.wr_parent = n.wr_id
		   AND n.bn_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
		 ORDER BY n.bn_datetime DESC
		 LIMIT 100`
    );

    const posts = await fetchPostDetails(
        refs.map((r) => ({
            bo_table: r.bo_table as string,
            bo_subject: r.bo_subject as string,
            wr_id: r.wr_id as number,
            mb_id: r.mb_nick as string,
            bn_datetime: r.bn_datetime as string
        }))
    );

    const popular = posts
        .filter((p) => p.wr_good >= 1)
        .sort(
            (a, b) =>
                b.wr_good - a.wr_good ||
                new Date(b.wr_datetime).getTime() - new Date(a.wr_datetime).getTime()
        )
        .slice(0, 30);

    const nickMap = new Map<string, string>();
    for (const r of refs) {
        nickMap.set(`${r.bo_table}-${r.wr_id}`, r.mb_nick as string);
    }
    for (const p of popular) {
        p.mb_nick = nickMap.get(`${p.bo_table}-${p.wr_id}`) || p.mb_id;
    }

    const normalizedPopular = popular.map((post) => ({
        ...post,
        bo_table: post.bo_table.toLowerCase()
    }));

    await groupPopularCache.set('popular', normalizedPopular);
    return normalizedPopular;
}

async function loadLatestCount(): Promise<number> {
    const cached = await groupLatestCountCache.get('count');
    if (cached !== null) return cached;

    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 WHERE n.wr_parent = n.wr_id`
    );
    const count = (rows[0]?.cnt as number) || 0;
    await groupLatestCountCache.set('count', count);
    return count;
}
