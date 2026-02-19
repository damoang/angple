/**
 * 게시글 첨부 이미지 API (g5_board_file 테이블)
 *
 * GET /api/boards/[boardId]/posts/[postId]/files
 * → { images: ["https://s3.damoang.net/data/file/free/xxx.jpg", ...] }
 *
 * Go 백엔드 API가 images 필드를 반환하지 않아
 * SvelteKit에서 직접 DB 조회하여 첨부 이미지 URL을 제공
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface FileRow extends RowDataPacket {
    bf_no: number;
    bf_file: string;
    bf_source: string;
    bf_type: number; // 0: 일반 첨부, 1~2: 에디터 삽입 이미지
    bf_width: number;
    bf_height: number;
}

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i;
const S3_BASE = 'https://s3.damoang.net/data/file';

export const GET: RequestHandler = async ({ params }) => {
    const { boardId, postId } = params;

    if (!boardId || !postId) {
        return json({ images: [] });
    }

    const safeBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safePostId = parseInt(postId, 10);

    if (isNaN(safePostId)) {
        return json({ images: [] });
    }

    try {
        const [rows] = await pool.query<FileRow[]>(
            `SELECT bf_no, bf_file, bf_source, bf_type, bf_width, bf_height
			 FROM g5_board_file
			 WHERE bo_table = ? AND wr_id = ?
			 ORDER BY bf_no`,
            [safeBoardId, safePostId]
        );

        // 이미지 파일만 필터링
        const images = rows
            .filter((row) => IMAGE_EXTENSIONS.test(row.bf_file))
            .map((row) => `${S3_BASE}/${safeBoardId}/${row.bf_file}`);

        return json({ images });
    } catch (error) {
        console.error('Board files GET error:', error);
        return json({ images: [] });
    }
};
