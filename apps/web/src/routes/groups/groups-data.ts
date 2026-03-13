/**
 * 소모임 데이터 조회 공통 모듈
 * +page.server.ts와 API 라우트에서 공유
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

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

/**
 * g5_board_new에서 최근 글 목록을 가져온 뒤,
 * 각 게시판의 동적 테이블(g5_write_{bo_table})에서 실제 글 정보를 조회
 */
export async function fetchPostDetails(
    refs: Array<{
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        mb_id: string;
        bn_datetime: string;
    }>
): Promise<GroupLatestPost[]> {
    if (refs.length === 0) return [];

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

/** 페이지네이션 쿼리 (API에서 사용) */
export async function loadLatestPostsPaginated(
    page: number,
    limit: number
): Promise<{ items: GroupLatestPost[]; total: number; hasMore: boolean }> {
    const offset = (page - 1) * limit;

    const [totalResult] = await readPool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 WHERE n.wr_parent = n.wr_id`
    );
    const total = (totalResult[0]?.cnt as number) || 0;

    const [refs] = await readPool.query<RowDataPacket[]>(
        `SELECT n.bo_table, b.bo_subject, n.wr_id, n.mb_id,
                IFNULL(m.mb_nick, n.mb_id) AS mb_nick,
                n.bn_datetime
		 FROM g5_board_new n
		 JOIN g5_board b ON b.bo_table = n.bo_table AND b.gr_id = 'group'
		 LEFT JOIN g5_member m ON m.mb_id = n.mb_id
		 WHERE n.wr_parent = n.wr_id
		 ORDER BY n.bn_datetime DESC
		 LIMIT ? OFFSET ?`,
        [limit, offset]
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

    return { items: posts, total, hasMore: offset + limit < total };
}
