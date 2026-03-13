/**
 * 소모임 전체 목록 페이지 서버
 * DB에서 group_id='group'인 게시판 목록을 조회합니다.
 */
import type { PageServerLoad } from './$types';
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { TieredCache } from '$lib/server/cache.js';

export interface GroupBoard {
    bo_table: string;
    bo_subject: string;
    bo_count_write: number;
    bo_count_comment: number;
    today_count: number;
}

export interface GroupLatestPost {
    bo_table: string;
    bo_subject: string;
    wr_id: number;
    wr_subject: string;
    mb_id: string;
    mb_nick: string;
    wr_datetime: string;
    wr_comment: number;
    wr_good: number;
}

/** 소모임 목록 캐시: L1 10분, L2(Redis) 30분 */
const groupBoardsCache = new TieredCache<GroupBoard[]>('group-boards', 600_000, 1800, 1);

/** 소모임 최근글 캐시: L1 3분, L2(Redis) 5분 */
const groupLatestCache = new TieredCache<GroupLatestPost[]>('group-latest', 180_000, 300, 1);

/** 소모임 추천글 캐시: L1 5분, L2(Redis) 15분 */
const groupPopularCache = new TieredCache<GroupLatestPost[]>('group-popular', 300_000, 900, 1);

export const load: PageServerLoad = async () => {
    const cacheKey = 'all';

    try {
        const [boards, latestPosts, popularPosts] = await Promise.all([
            loadGroupBoards(cacheKey),
            loadLatestPosts(),
            loadPopularPosts()
        ]);

        return { boards, latestPosts, popularPosts };
    } catch {
        return { boards: [], latestPosts: [], popularPosts: [] };
    }
};

async function loadGroupBoards(cacheKey: string): Promise<GroupBoard[]> {
    const cached = await groupBoardsCache.get(cacheKey);
    if (cached) return cached;

    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT b.bo_table, b.bo_subject, b.bo_count_write, b.bo_count_comment,
                IFNULL(n.cnt, 0) AS today_count
		 FROM g5_board b
		 LEFT JOIN (
		     SELECT bo_table, COUNT(*) AS cnt
		     FROM g5_board_new
		     WHERE bn_datetime >= CURDATE()
		     GROUP BY bo_table
		 ) n ON n.bo_table = b.bo_table
		 WHERE b.gr_id = 'group'
		 ORDER BY b.bo_order, b.bo_table`
    );
    const boards = rows as GroupBoard[];
    await groupBoardsCache.set(cacheKey, boards);
    return boards;
}

async function loadPopularPosts(): Promise<GroupLatestPost[]> {
    const cached = await groupPopularCache.get('popular');
    if (cached) return cached;

    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT n.bo_table, b.bo_subject, n.wr_id, n.wr_subject,
                n.mb_id, IFNULL(m.mb_nick, n.mb_id) AS mb_nick,
                n.bn_datetime AS wr_datetime, n.wr_comment, n.wr_good
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 LEFT JOIN g5_member m ON m.mb_id = n.mb_id
		 WHERE n.wr_parent = n.wr_id
		   AND n.bn_datetime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
		   AND n.wr_good >= 1
		 ORDER BY n.wr_good DESC, n.bn_datetime DESC
		 LIMIT 30`
    );
    const posts = rows as GroupLatestPost[];
    await groupPopularCache.set('popular', posts);
    return posts;
}

async function loadLatestPosts(): Promise<GroupLatestPost[]> {
    const cached = await groupLatestCache.get('latest');
    if (cached) return cached;

    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT n.bo_table, b.bo_subject, n.wr_id, n.wr_subject,
                n.mb_id, IFNULL(m.mb_nick, n.mb_id) AS mb_nick,
                n.bn_datetime AS wr_datetime, n.wr_comment, n.wr_good
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 LEFT JOIN g5_member m ON m.mb_id = n.mb_id
		 WHERE n.wr_parent = n.wr_id
		 ORDER BY n.bn_datetime DESC
		 LIMIT 30`
    );
    const posts = rows as GroupLatestPost[];
    await groupLatestCache.set('latest', posts);
    return posts;
}
