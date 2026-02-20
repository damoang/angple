import { apiClient } from '$lib/api/index.js';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types.js';

// CSR 전용 - Vite 프록시 사용을 위해 클라이언트에서만 로드
export const ssr = false;

export const load: PageLoad = async ({ params, fetch }) => {
    const { boardId, postId } = params;

    // postId가 숫자인지 검증 (레거시 PHP URL 방어: /bbs/board.php 등)
    if (!/^\d+$/.test(postId)) {
        throw error(404, '잘못된 게시글 주소입니다.');
    }

    try {
        const [post, comments, board, promotionPostsResult] = await Promise.all([
            apiClient.withFetch(fetch).getBoardPost(boardId, postId),
            apiClient.withFetch(fetch).getBoardComments(boardId, postId),
            apiClient.withFetch(fetch).getBoard(boardId),
            fetch('/api/ads/promotion-posts')
                .then((r) => r.json())
                .catch(() => ({ success: false, data: { posts: [] } }))
        ]);

        // 첨부 파일 로드 (Go API에서 미제공 → SvelteKit에서 직접 조회)
        try {
            const res = await fetch(`/api/boards/${boardId}/posts/${postId}/files`);
            if (res.ok) {
                const data = await res.json();
                if (data.images?.length) {
                    post.images = data.images;
                }
                if (data.videos?.length) {
                    post.videos = data.videos;
                }
            }
        } catch {
            // 첨부 파일 로드 실패 시 무시 (본문은 정상 표시)
        }

        return {
            boardId,
            post,
            comments,
            board,
            promotionPosts: promotionPostsResult?.data?.posts || []
        };
    } catch (err) {
        console.error('게시글 로딩 에러:', boardId, postId, err);
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};
