<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { apiClient } from '$lib/api/index.js';
    import type { FreePost } from '$lib/api/types.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CompactLayout from './layouts/list/compact.svelte';

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

<!-- 헤더 -->
<div class="mb-3 flex items-center justify-between">
    <a href="/{boardId}" class="text-foreground hover:text-primary text-lg font-bold transition-colors">
        {boardTitle}
    </a>
    <a href="/{boardId}" class="text-muted-foreground hover:text-foreground text-sm transition-colors">
        목록 전체보기 →
    </a>
</div>

{#if loading}
    <!-- 로딩 스켈레톤 -->
    <div class="space-y-1">
        {#each Array(5) as _, i (i)}
            <div class="bg-background rounded-lg border px-4 py-3">
                <div class="bg-muted mb-2 h-4 w-2/3 animate-pulse rounded"></div>
                <div class="bg-muted h-3 w-1/3 animate-pulse rounded"></div>
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
    <div class="space-y-1">
        {#each posts as post (post.id)}
            <CompactLayout {post} onclick={() => goToPost(post.id)} />
        {/each}
    </div>

    <!-- 페이지네이션 -->
    {#if totalPages > 1}
        <div class="mt-4 flex items-center justify-center gap-2">
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

        <p class="text-secondary-foreground mt-3 text-center text-sm">
            전체 {totalItems.toLocaleString()}개 중 {currentPage} / {totalPages} 페이지
        </p>
    {/if}
{/if}
