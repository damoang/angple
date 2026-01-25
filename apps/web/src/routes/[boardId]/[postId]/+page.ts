import { apiClient } from '$lib/api/index.js';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

// CSR 전용 - Vite 프록시 사용을 위해 클라이언트에서만 로드
export const ssr = false;

export const load: PageLoad = async ({ params }) => {
    const { boardId, postId } = params;

    try {
        const [post, comments, board] = await Promise.all([
            apiClient.getBoardPost(boardId, postId),
            apiClient.getBoardComments(boardId, postId),
            apiClient.getBoard(boardId)
        ]);

        return {
            boardId,
            post,
            comments,
            board
        };
    } catch (err) {
        console.error('게시글 로딩 에러:', boardId, postId, err);
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};
