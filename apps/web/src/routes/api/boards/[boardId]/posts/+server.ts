/**
 * 게시판 게시물 API
 * g5_write_{boardId} 테이블에서 게시물 조회
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { isInternalAppRequest } from '$lib/server/internal-api.js';
import { checkRateLimit, recordAttempt } from '$lib/server/rate-limit.js';

interface Post {
    wr_id: number;
    wr_subject: string;
    wr_datetime: string;
    wr_name: string;
    wr_hit: number;
}

const INTERNAL_POST_LIST_LIMIT = 50;
// 외부(브라우저) 요청 한 번에 가져올 수 있는 글 수. RecentPosts(하단 목록)가
// 게시판 목록과 같은 24개를 페이지네이션해야 하므로 그 이상으로 둔다 (#12571).
const EXTERNAL_POST_LIST_LIMIT = 30;
// 외부 페이지네이션 rate-limit: 같은 게시판 글은 이미 SSR HTML(/free?page=N)로 공개
// 페이지네이션되므로, 첫페이지 하드캡(이전 MAX_EXTERNAL_POST_LIST_OFFSET=0, #826)은
// 콘텐츠를 보호하지 못하면서 RecentPosts 만 깨뜨렸다. 하드캡 대신 rate-limit 으로
// 정상 페이지네이션은 허용하고 대량 스크래핑만 억제한다.
const EXTERNAL_POSTS_RATE_LIMIT = 60; // 분당 60회 (정상 탐색은 충분, 대량 호출 차단)
const EXTERNAL_POSTS_RATE_WINDOW_MS = 60_000;

export const GET: RequestHandler = async ({ params, url, request, getClientAddress }) => {
    const { boardId } = params;
    const isInternalRequest = isInternalAppRequest(request);
    const requestedLimit = Math.max(1, parseInt(url.searchParams.get('limit') || '10', 10));
    const limit = Math.min(
        requestedLimit,
        isInternalRequest ? INTERNAL_POST_LIST_LIMIT : EXTERNAL_POST_LIST_LIMIT
    );

    // offset 결정: 명시적 offset 우선(내부 호출 호환), 없으면 page → offset 계산.
    // 기존엔 page 를 아예 안 읽어 page=2,3 이 전부 offset=0(첫 페이지)로 동작했다 (#12571).
    const explicitOffset = url.searchParams.get('offset');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const offset =
        explicitOffset !== null ? Math.max(0, parseInt(explicitOffset, 10)) : (page - 1) * limit;

    // 외부(브라우저) 요청 rate-limit — 정상 페이지네이션 허용, 대량 호출만 차단.
    if (!isInternalRequest) {
        const ip = getClientAddress();
        const rl = checkRateLimit(
            ip,
            'board-posts',
            EXTERNAL_POSTS_RATE_LIMIT,
            EXTERNAL_POSTS_RATE_WINDOW_MS
        );
        if (!rl.allowed) {
            return json(
                { success: false, error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' },
                {
                    status: 429,
                    headers: rl.retryAfter ? { 'Retry-After': String(rl.retryAfter) } : {}
                }
            );
        }
        recordAttempt(ip, 'board-posts');
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
