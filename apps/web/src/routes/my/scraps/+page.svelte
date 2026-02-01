<script lang="ts">
    /**
     * 내 스크랩 목록 페이지
     */
    import { onMount } from 'svelte';
    import { apiClient } from '$lib/api';
    import type { Scrap } from '$lib/api/types.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import Bookmark from '@lucide/svelte/icons/bookmark';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

    let scraps = $state<Scrap[]>([]);
    let loading = $state(true);
    let page = $state(1);
    let totalPages = $state(1);
    let total = $state(0);
    let removingId = $state<number | null>(null);

    async function fetchScraps() {
        loading = true;
        try {
            const res = await apiClient.getMyScraps(page, 20);
            scraps = res.items;
            total = res.total;
            totalPages = res.total_pages;
        } catch {
            scraps = [];
        } finally {
            loading = false;
        }
    }

    async function removeScrap(scrap: Scrap) {
        removingId = scrap.id;
        try {
            await apiClient.unscrapPost(String(scrap.post_id));
            scraps = scraps.filter((s) => s.id !== scrap.id);
            total = Math.max(0, total - 1);
        } catch (err) {
            console.error('스크랩 해제 실패:', err);
        } finally {
            removingId = null;
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString('ko-KR');
    }

    onMount(() => {
        fetchScraps();
    });

    $effect(() => {
        void page;
        fetchScraps();
    });
</script>

<svelte:head>
    <title>내 스크랩 - Angple</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
    <div class="flex items-center gap-3">
        <Bookmark class="h-6 w-6" />
        <div>
            <h1 class="text-xl font-bold">내 스크랩</h1>
            <p class="text-muted-foreground text-sm">저장한 게시물 {total}건</p>
        </div>
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <p class="text-muted-foreground text-sm">로딩 중...</p>
        </div>
    {:else if scraps.length === 0}
        <div class="flex flex-col items-center justify-center py-16">
            <Bookmark class="text-muted-foreground mb-4 h-12 w-12" />
            <p class="text-muted-foreground">스크랩한 게시물이 없습니다.</p>
        </div>
    {:else}
        <div class="divide-y dark:divide-neutral-800">
            {#each scraps as scrap (scrap.id)}
                {@const isRemoving = removingId === scrap.id}
                <div
                    class="flex items-center gap-4 py-3 transition-opacity"
                    class:opacity-50={isRemoving}
                >
                    <div class="min-w-0 flex-1">
                        <a
                            href="/{scrap.board_id}/{scrap.post_id}"
                            class="hover:text-primary truncate font-medium transition-colors"
                        >
                            {scrap.post?.title ?? `게시물 #${scrap.post_id}`}
                        </a>
                        <div class="text-muted-foreground mt-0.5 flex gap-2 text-xs">
                            <span>{scrap.board_id}</span>
                            {#if scrap.post?.author}
                                <span>{scrap.post.author}</span>
                            {/if}
                            <span>스크랩: {formatDate(scrap.created_at)}</span>
                        </div>
                        {#if scrap.memo}
                            <p class="text-muted-foreground mt-1 text-xs italic">
                                {scrap.memo}
                            </p>
                        {/if}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onclick={() => removeScrap(scrap)}
                        disabled={isRemoving}
                        aria-label="스크랩 해제"
                    >
                        <Trash2 class="h-4 w-4 text-red-500" />
                    </Button>
                </div>
            {/each}
        </div>

        {#if totalPages > 1}
            <div class="flex items-center justify-center gap-2 pt-4">
                <Button
                    variant="outline"
                    size="icon"
                    onclick={() => (page = Math.max(1, page - 1))}
                    disabled={page <= 1}
                >
                    <ChevronLeft class="h-4 w-4" />
                </Button>
                <span class="text-muted-foreground text-sm">{page} / {totalPages}</span>
                <Button
                    variant="outline"
                    size="icon"
                    onclick={() => (page = Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                >
                    <ChevronRight class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    {/if}
</div>
