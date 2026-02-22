import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { FreePost } from '$lib/api/types.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8090';

export const load: PageServerLoad = async ({ params, fetch: svelteKitFetch, locals, url }) => {
    const { boardId, postId } = params;

    // postId가 숫자인지 검증 (레거시 PHP URL 방어: /bbs/board.php 등)
    if (!/^\d+$/.test(postId)) {
        throw error(404, '잘못된 게시글 주소입니다.');
    }

    // 인증 헤더 (SSR에서 accessToken 사용)
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (locals.accessToken) {
        headers['Authorization'] = `Bearer ${locals.accessToken}`;
    }

    try {
        // 게시글/게시판 정보 (필수) + 댓글/파일/광고 (보조)
        // 백엔드 API → globalThis.fetch (Origin 헤더 미포함, CORS 403 방지)
        // SvelteKit 내부 라우트 → svelteKitFetch (쿠키/상대경로 처리)
        const backendFetch = globalThis.fetch;
        const [postResult, boardResult, commentsResult, filesResult, promotionResult] =
            await Promise.allSettled([
                // 게시글 (Go 백엔드 직접 호출)
                backendFetch(`${BACKEND_URL}/api/v1/boards/${boardId}/posts/${postId}`, {
                    headers
                }).then(async (res) => {
                    if (!res.ok) throw new Error(`Post API error: ${res.status}`);
                    const json = await res.json();
                    return json.data as FreePost;
                }),
                // 게시판 정보
                backendFetch(`${BACKEND_URL}/api/v1/boards/${boardId}`, { headers }).then(
                    async (res) => {
                        if (!res.ok) return null;
                        const json = await res.json();
                        return json.data;
                    }
                ),
                // 댓글 (SvelteKit 내부 라우트 → svelteKitFetch)
                svelteKitFetch(
                    `${url.origin}/api/boards/${boardId}/posts/${postId}/comments?page=1&limit=200`
                ).then(async (res) => {
                    if (!res.ok)
                        return { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };
                    const json = await res.json();
                    if (!json.success)
                        return { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };
                    const data = json.data;
                    return {
                        items: data.comments || [],
                        total: data.total || 0,
                        page: data.page || 1,
                        limit: data.limit || 200,
                        total_pages: data.total_pages || 1
                    };
                }),
                // 첨부 파일 (SvelteKit 내부 라우트)
                svelteKitFetch(`${url.origin}/api/boards/${boardId}/posts/${postId}/files`).then(
                    async (res) => {
                        if (!res.ok) return null;
                        return res.json();
                    }
                ),
                // 직접홍보 사잇광고
                svelteKitFetch(`${url.origin}/api/ads/promotion-posts`)
                    .then((r) => r.json())
                    .catch(() => ({ success: false, data: { posts: [] } }))
            ]);

        // 게시글 필수 — 실패 시 404
        if (postResult.status === 'rejected') {
            console.error('게시글 로딩 에러:', boardId, postId, postResult.reason);
            throw error(404, '게시글을 찾을 수 없습니다.');
        }

        const post = postResult.value;
        const board = boardResult.status === 'fulfilled' ? boardResult.value : null;
        const comments =
            commentsResult.status === 'fulfilled'
                ? commentsResult.value
                : { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };

        // 첨부 파일 데이터 병합
        if (filesResult.status === 'fulfilled' && filesResult.value) {
            const filesData = filesResult.value;
            if (filesData.images?.length) {
                post.images = filesData.images;
            }
            if (filesData.videos?.length) {
                post.videos = filesData.videos;
            }
        }

        const promotionPosts =
            promotionResult.status === 'fulfilled' ? promotionResult.value?.data?.posts || [] : [];

        return {
            boardId,
            post,
            comments,
            board,
            promotionPosts
        };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // SvelteKit error() already thrown
        }
        console.error('게시글 로딩 에러:', boardId, postId, err);
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};
