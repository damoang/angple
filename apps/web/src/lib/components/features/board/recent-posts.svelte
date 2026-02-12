<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { apiClient } from '$lib/api/index.js';
    import type { FreePost } from '$lib/api/types.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CardLayout from './layouts/list/card.svelte';

    interface Props {
        boardId: string;
        boardTitle: string;
        currentPostId: number;
        limit?: number;
    }

    let { boardId, boardTitle, currentPostId, limit = 10 }: Props = $props();
    let posts = $state<FreePost[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 페이지네이션
    let currentPage = $state(1);
    let totalPages = $state(1);
    let totalItems = $state(0);

    // 게시글 상세로 이동
    function goToPost(id: number): void {
        goto(`/${boardId}/${id}`);
    }

    // 페이지 변경
    async function goToPage(page: number): Promise<void> {
        if (page < 1 || page > totalPages || page === currentPage) return;

        loading = true;
        try {
            const response = await apiClient.getBoardPosts(boardId, page, limit);
            posts = response.items.filter((p) => p.id !== currentPostId);
            currentPage = response.page;
            totalPages = response.total_pages;
            totalItems = response.total;

            // 작성자 레벨 배치 로드
            const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
            if (authorIds.length > 0) {
                void memberLevelStore.fetchLevels(authorIds);
            }
        } catch (err) {
            console.error('[RecentPosts] 페이지 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    onMount(async () => {
        if (!browser) return;

        try {
            const response = await apiClient.getBoardPosts(boardId, 1, limit);
            posts = response.items.filter((p) => p.id !== currentPostId);
            totalPages = response.total_pages;
            totalItems = response.total;

            // 작성자 레벨 배치 로드
            const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
            if (authorIds.length > 0) {
                void memberLevelStore.fetchLevels(authorIds);
            }
        } catch (err) {
            console.error('[RecentPosts] 최근글 로드 실패:', err);
            error = '최근글을 불러올 수 없습니다.';
        } finally {
            loading = false;
        }
    });

    // 페이지 번호 배열 계산
    const pageNumbers = $derived(() => {
        const pages: number[] = [];
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    });
</script>

<!--
    RecentPosts - 게시판 목록과 동일한 card 레이아웃 사용
    - layouts/list/card.svelte 컴포넌트 직접 사용
    - 테이블 형식 백업: recent-posts-table.svelte
-->
{#if loading}
    <!-- 로딩 스켈레톤 -->
    <div class="space-y-2">
        {#each Array(5) as _, i (i)}
            <div class="bg-background rounded-lg border p-4">
                <div class="bg-muted mb-2 h-5 w-3/4 animate-pulse rounded"></div>
                <div class="bg-muted mb-3 h-4 w-1/2 animate-pulse rounded"></div>
                <div class="bg-muted h-10 w-full animate-pulse rounded"></div>
            </div>
        {/each}
    </div>
{:else if error}
    <div class="py-8 text-center">
        <p class="text-muted-foreground text-sm">{error}</p>
    </div>
{:else if posts.length === 0}
    <div class="py-8 text-center">
        <p class="text-muted-foreground text-sm">최근 글이 없습니다.</p>
    </div>
{:else}
    <!-- 목록 (게시판 목록과 동일한 card 레이아웃) -->
    <div class="space-y-2">
        {#each posts as post (post.id)}
            <CardLayout {post} onclick={() => goToPost(post.id)} />
        {/each}
    </div>

    <!-- 페이지네이션 -->
    {#if totalPages > 1}
        <div class="mt-8 flex items-center justify-center gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onclick={() => goToPage(currentPage - 1)}
            >
                이전
            </Button>

            {#each pageNumbers() as pageNum (pageNum)}
                <Button
                    variant={pageNum === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => goToPage(pageNum)}
                >
                    {pageNum}
                </Button>
            {/each}

            <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onclick={() => goToPage(currentPage + 1)}
            >
                다음
            </Button>
        </div>

        <p class="text-secondary-foreground mt-4 text-center text-sm">
            전체 {totalItems.toLocaleString()}개 중 {currentPage} / {totalPages} 페이지
        </p>
    {/if}
{/if}
