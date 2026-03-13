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

export const load: PageServerLoad = async () => {
    const cacheKey = 'all';

    try {
        // 게시판 목록과 최근글을 병렬 조회
        const [boards, latestPosts] = await Promise.all([
            loadGroupBoards(cacheKey),
            loadLatestPosts()
        ]);

        return { boards, latestPosts };
    } catch (err) {
        console.error('[groups] load error:', err);
        return { boards: [], latestPosts: [] };
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

async function loadLatestPosts(): Promise<GroupLatestPost[]> {
    const cached = await groupLatestCache.get('latest');
    if (cached) return cached;

    // 1단계: g5_board_new에서 최근글 메타 정보 조회 (wr_subject는 이 테이블에 없음)
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT n.bo_table, b.bo_subject, n.wr_id,
                n.mb_id, IFNULL(m.mb_nick, n.mb_id) AS mb_nick,
                n.bn_datetime AS wr_datetime, n.wr_comment, n.wr_good
         FROM g5_board_new n
         JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
         LEFT JOIN g5_member m ON m.mb_id = n.mb_id
         WHERE n.wr_parent = n.wr_id
         ORDER BY n.bn_datetime DESC
         LIMIT 30`
    );

    if (rows.length === 0) {
        await groupLatestCache.set('latest', []);
        return [];
    }

    // 2단계: 게시판별로 g5_write_{bo_table}에서 제목 조회
    const byBoard = new Map<string, number[]>();
    for (const row of rows) {
        const ids = byBoard.get(row.bo_table) || [];
        ids.push(row.wr_id);
        byBoard.set(row.bo_table, ids);
    }

    const subjectMap = new Map<string, string>();
    await Promise.all(
        Array.from(byBoard.entries()).map(async ([boTable, wrIds]) => {
            try {
                const placeholders = wrIds.map(() => '?').join(',');
                const [subRows] = await readPool.query<RowDataPacket[]>(
                    `SELECT wr_id, wr_subject FROM g5_write_${boTable} WHERE wr_id IN (${placeholders})`,
                    wrIds
                );
                for (const r of subRows) {
                    subjectMap.set(`${boTable}:${r.wr_id}`, r.wr_subject);
                }
            } catch {
                // 테이블이 없거나 에러 시 무시
            }
        })
    );

    const posts: GroupLatestPost[] = rows.map((row) => ({
        bo_table: row.bo_table,
        bo_subject: row.bo_subject,
        wr_id: row.wr_id,
        wr_subject: subjectMap.get(`${row.bo_table}:${row.wr_id}`) || '(제목 없음)',
        mb_id: row.mb_id,
        mb_nick: row.mb_nick,
        wr_datetime: row.wr_datetime,
        wr_comment: row.wr_comment,
        wr_good: row.wr_good
    }));

    await groupLatestCache.set('latest', posts);
    return posts;
}
