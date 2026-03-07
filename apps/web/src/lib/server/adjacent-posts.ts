/**
 * 이전글/다음글 조회 (게시글 상세 페이지용)
 *
 * g5_write_{boardId} 테이블에서 wr_num 기준으로 이전/다음 원글을 찾습니다.
 * Gnuboard 규칙: wr_num은 음수, 작을수록 최신글.
 * wr_is_comment = 0 (원글만 대상)
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

interface AdjacentRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
}

export interface AdjacentPost {
    id: number;
    title: string;
}

export interface AdjacentPosts {
    prev: AdjacentPost | null;
    next: AdjacentPost | null;
}

/**
 * 이전글/다음글 조회
 * @param boardId - 게시판 ID (영문+숫자+_만 허용)
 * @param postId - 현재 게시글 ID
 */
export async function getAdjacentPosts(boardId: string, postId: number): Promise<AdjacentPosts> {
    // 테이블명 안전성 검증
    if (!/^[a-zA-Z0-9_]+$/.test(boardId)) {
        return { prev: null, next: null };
    }

    const table = `g5_write_${boardId}`;

    try {
        // 현재 글의 wr_num 조회
        const [currentRows] = await readPool.query<(RowDataPacket & { wr_num: number })[]>(
            `SELECT wr_num FROM \`${table}\` WHERE wr_id = ? AND wr_is_comment = 0`,
            [postId]
        );

        if (currentRows.length === 0) {
            return { prev: null, next: null };
        }

        const currentNum = currentRows[0].wr_num;

        // 이전글 (wr_num이 더 큰 값 = 더 오래된 글) + 다음글 (wr_num이 더 작은 값 = 더 최신 글) 병렬
        const [prevRows, nextRows] = await Promise.all([
            readPool.query<AdjacentRow[]>(
                `SELECT wr_id, wr_subject FROM \`${table}\`
				 WHERE wr_num > ? AND wr_is_comment = 0
				 ORDER BY wr_num ASC LIMIT 1`,
                [currentNum]
            ),
            readPool.query<AdjacentRow[]>(
                `SELECT wr_id, wr_subject FROM \`${table}\`
				 WHERE wr_num < ? AND wr_is_comment = 0
				 ORDER BY wr_num DESC LIMIT 1`,
                [currentNum]
            )
        ]);

        return {
            prev:
                prevRows[0].length > 0
                    ? { id: prevRows[0][0].wr_id, title: prevRows[0][0].wr_subject }
                    : null,
            next:
                nextRows[0].length > 0
                    ? { id: nextRows[0][0].wr_id, title: nextRows[0][0].wr_subject }
                    : null
        };
    } catch {
        return { prev: null, next: null };
    }
}
