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
}

/** 소모임 목록 캐시: L1 10분, L2(Redis) 30분 */
const groupBoardsCache = new TieredCache<GroupBoard[]>('group-boards', 600_000, 1800, 1);

export const load: PageServerLoad = async () => {
    const cacheKey = 'all';

    try {
        const cached = await groupBoardsCache.get(cacheKey);
        if (cached) return { boards: cached };

        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT bo_table, bo_subject, bo_count_write, bo_count_comment
			 FROM g5_board
			 WHERE gr_id = 'group'
			 ORDER BY bo_order, bo_table`
        );
        const boards = rows as GroupBoard[];
        await groupBoardsCache.set(cacheKey, boards);
        return { boards };
    } catch {
        return { boards: [] };
    }
};
