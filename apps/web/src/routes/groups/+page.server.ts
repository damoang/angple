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
    } catch (err) {
        console.error('[groups] 데이터 로딩 에러:', err);
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

/**
 * g5_board_new에서 최근 글 목록을 가져온 뒤,
 * 각 게시판의 동적 테이블(g5_write_{bo_table})에서 실제 글 정보를 조회
 */
async function fetchPostDetails(
    refs: Array<{
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        mb_id: string;
        bn_datetime: string;
    }>
): Promise<GroupLatestPost[]> {
    if (refs.length === 0) return [];

    // bo_table별로 그룹핑
    const grouped = new Map<string, typeof refs>();
    for (const ref of refs) {
        const list = grouped.get(ref.bo_table) || [];
        list.push(ref);
        grouped.set(ref.bo_table, list);
    }

    const results: GroupLatestPost[] = [];
    const promises: Promise<void>[] = [];

    for (const [boTable, items] of grouped) {
        const safeTable = boTable.replace(/[^a-zA-Z0-9_-]/g, '');
        const wrIds = items.map((i) => i.wr_id);

        promises.push(
            readPool
                .query<RowDataPacket[]>(
                    `SELECT wr_id, wr_subject, wr_comment, wr_good
                     FROM g5_write_${safeTable}
                     WHERE wr_id IN (?) AND wr_is_comment = 0`,
                    [wrIds]
                )
                .then(([rows]) => {
                    const postMap = new Map<number, RowDataPacket>();
                    for (const row of rows) {
                        postMap.set(row.wr_id as number, row);
                    }

                    for (const item of items) {
                        const post = postMap.get(item.wr_id);
                        if (post) {
                            results.push({
                                bo_table: item.bo_table,
                                bo_subject: item.bo_subject,
                                wr_id: item.wr_id,
                                wr_subject: post.wr_subject as string,
                                mb_id: item.mb_id,
                                mb_nick: item.mb_id,
                                wr_datetime: item.bn_datetime,
                                wr_comment: (post.wr_comment as number) || 0,
                                wr_good: (post.wr_good as number) || 0
                            });
                        }
                    }
                })
                .catch((err) => {
                    console.error(`[groups] g5_write_${safeTable} 조회 에러:`, err);
                })
        );
    }

    await Promise.all(promises);

    return results;
}

async function loadLatestPosts(): Promise<GroupLatestPost[]> {
    const cached = await groupLatestCache.get('latest');
    if (cached) return cached;

    // 1단계: g5_board_new에서 최근 원글(댓글 아닌) 목록 + 닉네임
    const [refs] = await readPool.query<RowDataPacket[]>(
        `SELECT n.bo_table, b.bo_subject, n.wr_id, n.mb_id,
                IFNULL(m.mb_nick, n.mb_id) AS mb_nick,
                n.bn_datetime
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 LEFT JOIN g5_member m ON m.mb_id = n.mb_id
		 WHERE n.wr_parent = n.wr_id
		 ORDER BY n.bn_datetime DESC
		 LIMIT 30`
    );

    // 2단계: 각 게시판 테이블에서 실제 글 제목/댓글수/추천수 조회
    const posts = await fetchPostDetails(
        refs.map((r) => ({
            bo_table: r.bo_table as string,
            bo_subject: r.bo_subject as string,
            wr_id: r.wr_id as number,
            mb_id: r.mb_nick as string,
            bn_datetime: r.bn_datetime as string
        }))
    );

    // bn_datetime 기준 정렬 (병렬 조회 후 순서 보장)
    posts.sort((a, b) => new Date(b.wr_datetime).getTime() - new Date(a.wr_datetime).getTime());

    // mb_nick 복원 (fetchPostDetails에서 mb_id에 닉네임을 넣어둠)
    const nickMap = new Map<string, string>();
    for (const r of refs) {
        nickMap.set(`${r.bo_table}-${r.wr_id}`, r.mb_nick as string);
    }
    for (const p of posts) {
        p.mb_nick = nickMap.get(`${p.bo_table}-${p.wr_id}`) || p.mb_id;
    }

    await groupLatestCache.set('latest', posts);
    return posts;
}

async function loadPopularPosts(): Promise<GroupLatestPost[]> {
    const cached = await groupPopularCache.get('popular');
    if (cached) return cached;

    // 1단계: 최근 7일 원글 목록
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

    // 2단계: 실제 글 정보 조회
    const posts = await fetchPostDetails(
        refs.map((r) => ({
            bo_table: r.bo_table as string,
            bo_subject: r.bo_subject as string,
            wr_id: r.wr_id as number,
            mb_id: r.mb_nick as string,
            bn_datetime: r.bn_datetime as string
        }))
    );

    // 추천 1 이상만 필터 + 추천순 정렬
    const popular = posts
        .filter((p) => p.wr_good >= 1)
        .sort(
            (a, b) =>
                b.wr_good - a.wr_good ||
                new Date(b.wr_datetime).getTime() - new Date(a.wr_datetime).getTime()
        )
        .slice(0, 30);

    // mb_nick 복원
    const nickMap = new Map<string, string>();
    for (const r of refs) {
        nickMap.set(`${r.bo_table}-${r.wr_id}`, r.mb_nick as string);
    }
    for (const p of popular) {
        p.mb_nick = nickMap.get(`${p.bo_table}-${p.wr_id}`) || p.mb_id;
    }

    await groupPopularCache.set('popular', popular);
    return popular;
}
