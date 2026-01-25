import type { PageLoad } from './$types.js';
import { apiClient } from '$lib/api/index.js';
import { error } from '@sveltejs/kit';

// CSR 전용 - Vite 프록시 사용을 위해 클라이언트에서만 로드
export const ssr = false;

/**
 * 게시글 수정 페이지 데이터 로드
 * 기존 게시글 정보와 게시판 정보를 가져옴
 */
export const load: PageLoad = async ({ params }) => {
    const { boardId, postId } = params;

    try {
        const [post, board] = await Promise.all([
            apiClient.getBoardPost(boardId, postId),
            apiClient.getBoard(boardId)
        ]);

        // 카테고리 목록 파싱
        const categories = board.category_list
            ? board.category_list.split('|').filter((c) => c.trim())
            : [];

        return {
            boardId,
            post,
            board,
            categories
        };
    } catch (err) {
        console.error(`Failed to load post ${boardId}/${postId} for editing:`, err);
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};
