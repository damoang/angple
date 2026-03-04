import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';
import type { FreePost } from '$lib/api/types.js';
import { fetchPromotionPosts } from '$lib/server/ads/promotion.js';
import { transformAffiliateContent } from '$lib/hooks/builtin/affiliate.js';
import { isScraped } from '$lib/server/scrap.js';
import { backendFetch as bFetch, createAuthHeaders } from '$lib/server/backend-fetch.js';

export const load: PageServerLoad = async ({ params, fetch: svelteKitFetch, locals, url }) => {
    const { boardId, postId } = params;

    // postId가 숫자인지 검증 (레거시 PHP URL 방어: /bbs/board.php 등)
    if (!/^\d+$/.test(postId)) {
        throw error(404, '잘못된 게시글 주소입니다.');
    }

    // 인증 헤더 (SSR에서 accessToken 사용)
    const headers = createAuthHeaders(locals.accessToken);

    try {
        // 게시글/게시판 정보 (필수) + 댓글/파일/광고 (보조)
        // backendFetch → Go 백엔드 (timeout 5s + circuit breaker)
        // svelteKitFetch → SvelteKit 내부 라우트 (쿠키/상대경로 처리)
        const [
            postResult,
            boardResult,
            displaySettingsResult,
            commentsResult,
            filesResult,
            promotionResult,
            revisionsResult
        ] = await Promise.allSettled([
            // 게시글 (Go 백엔드 직접 호출)
            bFetch(`/api/v1/boards/${boardId}/posts/${postId}`, {
                headers
            }).then(async (res) => {
                if (!res.ok) throw new Error(`Post API error: ${res.status}`);
                const json = await res.json();
                return json.data as FreePost;
            }),
            // 게시판 정보
            bFetch(`/api/v1/boards/${boardId}`, { headers }).then(async (res) => {
                if (!res.ok) return null;
                const json = await res.json();
                return json.data;
            }),
            // 게시판 표시 설정
            bFetch(`/api/v1/boards/${boardId}/display-settings`, {
                headers
            }).then(async (res) => {
                if (!res.ok) return null;
                const json = await res.json();
                return json.data;
            }),
            // 댓글 (SvelteKit 내부 라우트 → svelteKitFetch)
            svelteKitFetch(
                `${url.origin}/api/boards/${boardId}/posts/${postId}/comments?page=1&limit=200`
            ).then(async (res) => {
                if (!res.ok) return { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };
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
            // 직접홍보 사잇광고 (ads 서버 직접 호출 + 캐시)
            fetchPromotionPosts(),
            // 리비전 히스토리 (관리자 level ≥ 10일 때만)
            (locals.user?.level ?? 0) >= 10
                ? bFetch(`/api/v1/boards/${boardId}/posts/${postId}/revisions`, {
                      headers
                  }).then(async (res) => {
                      if (!res.ok) return [];
                      const json = await res.json();
                      return json.data || [];
                  })
                : Promise.resolve([])
        ]);

        // 게시글 필수 — 실패 시 404
        if (postResult.status === 'rejected') {
            console.error('게시글 로딩 에러:', boardId, postId, postResult.reason);
            throw error(404, '게시글을 찾을 수 없습니다.');
        }

        const post = postResult.value;

        // 게시글 데이터가 null인 경우 (백엔드 응답이 { data: null })
        if (!post) {
            throw error(404, '게시글을 찾을 수 없습니다.');
        }

        // 삭제된 게시글: 에러 대신 데이터 전달 (PHP 호환: "삭제된 게시물입니다" 표시)
        // 본문 내용은 제거하고 삭제 상태만 전달
        if (post.deleted_at) {
            post.content = '';
        }
        let board = boardResult.status === 'fulfilled' ? boardResult.value : null;

        // display_settings 병합
        if (board && displaySettingsResult.status === 'fulfilled' && displaySettingsResult.value) {
            board = { ...board, display_settings: displaySettingsResult.value };
        }

        // 게시판 접근 권한 체크 (list_level, read_level 중 높은 값)
        if (board) {
            const userLevel = locals.user?.level ?? 1;
            const requiredLevel = Math.max(board.list_level ?? 1, board.read_level ?? 1);
            if (userLevel < requiredLevel) {
                throw error(403, '이 게시판에 접근할 권한이 없습니다.');
            }
        }
        const comments =
            commentsResult.status === 'fulfilled'
                ? commentsResult.value
                : { items: [], total: 0, page: 1, limit: 200, total_pages: 0 };

        // 첨부 파일 데이터 병합 (본문에 이미 포함된 이미지는 제외)
        if (filesResult.status === 'fulfilled' && filesResult.value) {
            const filesData = filesResult.value;
            if (filesData.images?.length) {
                const content = post.content || '';
                post.images = filesData.images.filter((img: string) => !content.includes(img));
            }
            if (filesData.videos?.length) {
                post.videos = filesData.videos;
            }
        }

        // 프로모션 사잇광고: board_exception에 포함된 게시판은 제외
        let promotionPosts: unknown[] = [];
        if (promotionResult.status === 'fulfilled') {
            const promoData = promotionResult.value?.data;
            const boardException = (promoData?.board_exception || '') as string;
            const excludedBoards = boardException.split(',').map((s: string) => s.trim());
            if (!excludedBoards.includes(boardId)) {
                promotionPosts = promoData?.posts || [];
            }
        }

        const revisions = revisionsResult.status === 'fulfilled' ? revisionsResult.value || [] : [];

        // 스크랩 여부 (로그인 시만)
        const isScrapped = locals.user?.id
            ? await isScraped(locals.user.id, boardId, postId).catch(() => false)
            : false;

        // 제휴 링크 서버사이드 변환 (본문 + 댓글)
        const affiliateContext = { bo_table: boardId, wr_id: Number(postId) };
        try {
            const transformPromises: Promise<void>[] = [];

            // 본문 변환
            if (post.content) {
                transformPromises.push(
                    transformAffiliateContent(post.content, affiliateContext).then((html) => {
                        post.content = html;
                    })
                );
            }

            // 댓글 변환
            if (comments.items?.length) {
                for (const comment of comments.items) {
                    if (comment.content) {
                        transformPromises.push(
                            transformAffiliateContent(comment.content, affiliateContext).then(
                                (html) => {
                                    comment.content = html;
                                }
                            )
                        );
                    }
                }
            }

            // 병렬 처리 (타임아웃 3초)
            if (transformPromises.length > 0) {
                await Promise.race([
                    Promise.allSettled(transformPromises),
                    new Promise((resolve) => setTimeout(resolve, 3000))
                ]);
            }
        } catch {
            // 변환 실패 시 원본 유지
        }

        return {
            boardId,
            post,
            comments,
            board,
            promotionPosts,
            revisions,
            isScrapped
        };
    } catch (err) {
        if (err && typeof err === 'object' && 'status' in err) {
            throw err; // SvelteKit error() already thrown
        }
        console.error('게시글 로딩 에러:', boardId, postId, err);
        throw error(404, '게시글을 찾을 수 없습니다.');
    }
};
