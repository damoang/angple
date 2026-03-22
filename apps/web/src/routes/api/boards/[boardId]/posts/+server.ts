/**
 * 게시판 게시물 API
 * g5_write_{boardId} 테이블에서 게시물 조회
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { isInternalAppRequest } from '$lib/server/internal-api.js';

interface Post {
    wr_id: number;
    wr_subject: string;
    wr_datetime: string;
    wr_name: string;
    wr_hit: number;
}

const INTERNAL_POST_LIST_LIMIT = 50;
const EXTERNAL_POST_LIST_LIMIT = 10;
const MAX_EXTERNAL_POST_LIST_OFFSET = 0;

export const GET: RequestHandler = async ({ params, url, request }) => {
    const { boardId } = params;
    const isInternalRequest = isInternalAppRequest(request);
    const requestedLimit = Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10));
    const limit = Math.min(
        requestedLimit,
        isInternalRequest ? INTERNAL_POST_LIST_LIMIT : EXTERNAL_POST_LIST_LIMIT
    );
    const requestedOffset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
    const offset = isInternalRequest
        ? requestedOffset
        : Math.min(requestedOffset, MAX_EXTERNAL_POST_LIST_OFFSET);

    if (!isInternalRequest && requestedOffset > 0) {
        return json(
            { success: false, error: '외부 요청은 첫 페이지 목록만 조회할 수 있습니다.' },
            { status: 403 }
        );
    }

    // boardId 유효성 검사 (영문, 숫자, 언더스코어만 허용)
    if (!/^[a-zA-Z0-9_]+$/.test(boardId)) {
        return json({ success: false, error: 'Invalid board ID' }, { status: 400 });
    }

    try {
        const tableName = `g5_write_${boardId}`;

        // 테이블 존재 여부 확인
        const [tables] = await pool.execute<RowDataPacket[]>(
            `SELECT TABLE_NAME FROM information_schema.TABLES
			 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [tableName]
        );

        if (tables.length === 0) {
            return json({ success: false, error: 'Board not found' }, { status: 404 });
        }

        // 게시물 조회 (댓글 제외, 최신순)
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT wr_id, wr_subject, wr_datetime, wr_name, wr_hit
			 FROM ${tableName}
			 WHERE wr_is_comment = 0
			 ORDER BY wr_num, wr_reply
			 LIMIT ${limit} OFFSET ${offset}`
        );

        return json({
            success: true,
            data: rows as Post[]
        });
    } catch (error) {
        console.error('Board posts API error:', error);
        return json({ success: false, error: 'Failed to fetch posts' }, { status: 500 });
    }
};
