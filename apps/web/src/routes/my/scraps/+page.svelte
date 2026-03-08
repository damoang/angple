<script lang="ts">
    /**
     * 내 스크랩 목록 페이지 (SSR + 검색)
     */
    import { goto } from '$app/navigation';
    import { invalidate } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import Bookmark from '@lucide/svelte/icons/bookmark';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import Search from '@lucide/svelte/icons/search';
    import X from '@lucide/svelte/icons/x';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    let removingId = $state<number | null>(null);
    let searchInput = $state(data.query || '');

    function handleSearch(e: Event) {
        e.preventDefault();
        const q = searchInput.trim();
        if (q) {
            goto(`/my/scraps?q=${encodeURIComponent(q)}`);
        } else {
            goto('/my/scraps');
        }
    }

    function clearSearch() {
        searchInput = '';
        goto('/my/scraps');
    }

    async function removeScrap(msId: number, boTable: string, wrId: string) {
        removingId = msId;
        try {
            const res = await fetch('/api/scraps', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId: boTable, postId: wrId })
            });
            if (res.ok) {
                await invalidate('app:scraps');
            }
        } catch (err) {
            console.error('스크랩 해제 실패:', err);
        } finally {
            removingId = null;
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function goToPage(pageNum: number): void {
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        if (data.query) params.set('q', data.query);
        goto(`/my/scraps?${params.toString()}`);
    }

    function getPageNumbers(current: number, total: number): (number | '...')[] {
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages: (number | '...')[] = [];
        if (current <= 3) {
            for (let i = 1; i <= 4; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        } else if (current >= total - 2) {
            pages.push(1);
            pages.push('...');
            for (let i = total - 3; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            pages.push('...');
            for (let i = current - 1; i <= current + 1; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        }
        return pages;
    }
</script>

<svelte:head>
    <title>내 스크랩 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4">
    <!-- 헤더 -->
    <div class="mb-6">
        <h1 class="text-foreground text-2xl font-bold">내 스크랩</h1>
        <p class="text-muted-foreground mt-1 text-sm">
            저장한 게시물 {data.total}건
        </p>
    </div>

    <!-- 요약 카드 -->
    <div class="mb-6">
        <Card class="bg-primary/5 border-primary/20">
            <CardContent class="pt-6">
                <div class="flex items-center gap-3">
                    <div class="bg-primary/10 rounded-full p-3">
                        <Bookmark class="text-primary h-6 w-6" />
                    </div>
                    <div>
                        <p class="text-muted-foreground text-sm">스크랩 수</p>
                        <p class="text-foreground text-2xl font-bold">
                            {data.total.toLocaleString()}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- 검색 -->
    <form class="mb-4" onsubmit={handleSearch}>
        <div class="relative">
            <Search
                class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            />
            <Input
                type="text"
                placeholder="스크랩한 게시물 제목 검색..."
                class="pl-10 pr-10"
                bind:value={searchInput}
            />
            {#if searchInput}
                <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    onclick={clearSearch}
                >
                    <X class="h-4 w-4" />
                </button>
            {/if}
        </div>
    </form>

    <!-- 검색 결과 안내 -->
    {#if data.query}
        <div class="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
            <Search class="h-3.5 w-3.5" />
            <span>
                "<strong class="text-foreground">{data.query}</strong>" 검색 결과 {data.total}건
            </span>
            <button class="text-primary hover:underline" onclick={clearSearch}> 전체 보기 </button>
        </div>
    {/if}

    <!-- 스크랩 목록 -->
    <Card class="bg-background">
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <Bookmark class="h-5 w-5" />
                스크랩 목록
                <span class="text-muted-foreground text-sm font-normal">
                    ({data.total}건)
                </span>
            </CardTitle>
        </CardHeader>
        <CardContent>
            {#if data.scraps.length > 0}
                <ul class="divide-border divide-y">
                    {#each data.scraps as scrap (scrap.ms_id)}
                        {@const isRemoving = removingId === scrap.ms_id}
                        <li
                            class="py-3 transition-opacity first:pt-0 last:pb-0"
                            class:opacity-50={isRemoving}
                        >
                            <div class="flex items-center gap-4">
                                <div class="min-w-0 flex-1">
                                    <a
                                        href="/{scrap.bo_table}/{scrap.wr_id}"
                                        class="hover:bg-accent -mx-2 -my-1 block rounded-md px-2 py-1 no-underline transition-colors"
                                    >
                                        <h3 class="text-foreground line-clamp-1 font-medium">
                                            {scrap.wr_subject ?? `게시물 #${scrap.wr_id}`}
                                        </h3>
                                        <div
                                            class="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs"
                                        >
                                            <span class="bg-muted rounded px-1.5 py-0.5 text-xs">
                                                {scrap.bo_table}
                                            </span>
                                            {#if scrap.wr_name}
                                                <span>{scrap.wr_name}</span>
                                                <span>·</span>
                                            {/if}
                                            <span>{formatDate(scrap.ms_datetime)}</span>
                                        </div>
                                    </a>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    class="text-muted-foreground hover:text-destructive shrink-0"
                                    onclick={() =>
                                        removeScrap(scrap.ms_id, scrap.bo_table, scrap.wr_id)}
                                    disabled={isRemoving}
                                    aria-label="스크랩 해제"
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            </div>
                        </li>
                    {/each}
                </ul>
            {:else}
                <div class="flex flex-col items-center justify-center py-12">
                    <div class="bg-muted mb-4 rounded-full p-4">
                        <Bookmark class="text-muted-foreground h-8 w-8" />
                    </div>
                    {#if data.query}
                        <p class="text-muted-foreground text-sm">
                            "{data.query}"에 해당하는 스크랩이 없습니다.
                        </p>
                        <Button variant="outline" size="sm" class="mt-3" onclick={clearSearch}>
                            전체 스크랩 보기
                        </Button>
                    {:else}
                        <p class="text-foreground mb-1 font-medium">아직 스크랩이 없어요</p>
                        <p class="text-muted-foreground text-sm">
                            관심있는 게시물의 북마크 아이콘을 눌러 저장해보세요.
                        </p>
                    {/if}
                </div>
            {/if}
        </CardContent>
    </Card>

    <!-- 페이지네이션 -->
    {#if data.totalPages > 1}
        <div class="mt-6 flex items-center justify-center gap-1">
            <Button
                variant="outline"
                size="sm"
                disabled={data.page === 1}
                onclick={() => goToPage(data.page - 1)}
            >
                <ChevronLeft class="h-4 w-4" />
                이전
            </Button>

            {#each getPageNumbers(data.page, data.totalPages) as pageNum}
                {#if pageNum === '...'}
                    <span class="text-muted-foreground px-2 text-sm">...</span>
                {:else}
                    <Button
                        variant={data.page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        class="min-w-9"
                        onclick={() => goToPage(pageNum)}
                    >
                        {pageNum}
                    </Button>
                {/if}
            {/each}

            <Button
                variant="outline"
                size="sm"
                disabled={data.page === data.totalPages}
                onclick={() => goToPage(data.page + 1)}
            >
                다음
                <ChevronRight class="h-4 w-4" />
            </Button>
        </div>
    {/if}
</div>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        line-clamp: 1;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
