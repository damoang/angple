<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Select from '$lib/components/ui/select/index.js';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Eye from '@lucide/svelte/icons/eye';
    import FeedSkeleton from '$lib/components/features/feed/feed-skeleton.svelte';
    import { formatCommentCountBadge } from '$lib/utils/comment-count.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    // 필터 옵션
    const viewOptions = [
        { value: '', label: '전체' },
        { value: 'w', label: '글만' },
        { value: 'c', label: '댓글만' }
    ];

    const selectedViewLabel = $derived(
        viewOptions.find((o) => o.value === data.currentView)?.label || '전체'
    );

    const selectedGroupLabel = $derived(
        data.currentGroup
            ? data.groups.find((g) => g.gr_id === data.currentGroup)?.gr_subject ||
                  data.currentGroup
            : '전체 그룹'
    );

    // 필터 변경
    function updateFilter(key: string, value: string): void {
        const url = new URL(window.location.href);
        if (value) {
            url.searchParams.set(key, value);
        } else {
            url.searchParams.delete(key);
        }
        url.searchParams.set('page', '1');
        url.searchParams.delete('cursor');
        goto(url.pathname + url.search);
    }

    // 페이지 이동 (커서 기반)
    function goToPage(pageNum: number, nextCursor?: number | null): void {
        const url = new URL(window.location.href);
        url.searchParams.set('page', String(pageNum));
        if (nextCursor && pageNum > data.page) {
            url.searchParams.set('cursor', String(nextCursor));
        } else {
            url.searchParams.delete('cursor');
        }
        goto(url.pathname + url.search);
    }

    // 시간 포맷
    function formatTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (targetDate.getTime() === today.getTime()) {
            return date.toLocaleTimeString('ko-KR', {
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } else {
            return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
        }
    }

    // 댓글인지 여부
    function isComment(item: { wr_id: number; wr_parent: number }): boolean {
        return item.wr_id !== item.wr_parent;
    }
</script>

<svelte:head>
    <title>새글 모아보기 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
    <meta
        name="description"
        content="{import.meta.env.VITE_SITE_NAME ||
            'Angple'} 커뮤니티 최신 글과 댓글을 한눈에 확인하세요."
    />
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    {#await data.streamed?.posts}
        <!-- 스켈레톤 (데이터 로딩 중) -->
        <FeedSkeleton />
    {:then result}
        <!-- 게시글 목록 카드 -->
        <Card class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
            <!-- 카드 헤더 -->
            <CardHeader class="border-border border-b px-4 py-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <!-- 타이틀 -->
                    <div class="flex items-center gap-3">
                        <div
                            class="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg"
                        >
                            <Newspaper class="text-primary h-5 w-5" />
                        </div>
                        <div>
                            <h1 class="text-foreground text-xl font-bold leading-tight">
                                새글 모아보기
                            </h1>
                            <p class="text-muted-foreground text-sm">
                                전체 {result.total.toLocaleString()}건
                            </p>
                        </div>
                    </div>

                    <!-- 필터 -->
                    <div class="flex flex-wrap gap-2">
                        <Select.Root
                            type="single"
                            value={data.currentView}
                            onValueChange={(v) => updateFilter('view', v || '')}
                        >
                            <Select.Trigger class="h-9 w-[100px] text-sm"
                                >{selectedViewLabel}</Select.Trigger
                            >
                            <Select.Content>
                                {#each viewOptions as opt (opt.value)}
                                    <Select.Item value={opt.value}>{opt.label}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>

                        <Select.Root
                            type="single"
                            value={data.currentGroup}
                            onValueChange={(v) => updateFilter('gr_id', v || '')}
                        >
                            <Select.Trigger class="h-9 w-[140px] text-sm"
                                >{selectedGroupLabel}</Select.Trigger
                            >
                            <Select.Content>
                                <Select.Item value="">전체 그룹</Select.Item>
                                {#each data.groups as group (group.gr_id)}
                                    <Select.Item value={group.gr_id}>{group.gr_subject}</Select.Item
                                    >
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </div>
                </div>
            </CardHeader>

            <!-- 목록 -->
            <CardContent class="p-0">
                {#if result.items.length === 0}
                    <div class="py-16 text-center">
                        <div
                            class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                        >
                            <Newspaper class="text-muted-foreground h-8 w-8" />
                        </div>
                        <p class="text-foreground mb-1 text-lg font-medium">아직 새 글이 없어요</p>
                        <p class="text-muted-foreground text-sm">첫 번째 글을 작성해보세요!</p>
                    </div>
                {:else}
                    <div class="divide-border divide-y">
                        {#each result.items as item (item.bn_id)}
                            <a
                                href={isComment(item)
                                    ? `/${item.bo_table}/${item.wr_parent}#c_${item.wr_id}`
                                    : `/${item.bo_table}/${item.wr_id}`}
                                class="hover:bg-muted/50 block px-4 py-2.5 no-underline transition-all duration-200"
                            >
                                <div class="flex items-center gap-2 md:gap-3">
                                    <div class="hidden shrink-0 md:block">
                                        <span
                                            class="bg-muted text-muted-foreground inline-flex h-7 w-16 items-center justify-center rounded-lg text-xs font-medium"
                                        >
                                            {item.bo_subject}
                                        </span>
                                    </div>

                                    <div class="min-w-0 flex-1">
                                        <div
                                            class="flex flex-col gap-1 md:flex-row md:items-center md:gap-3"
                                        >
                                            <div class="flex min-w-0 flex-1 items-center gap-1.5">
                                                {#if isComment(item)}
                                                    <span
                                                        class="bg-muted flex h-5 w-5 shrink-0 items-center justify-center rounded"
                                                    >
                                                        <MessageSquare
                                                            class="text-muted-foreground h-3 w-3"
                                                        />
                                                    </span>
                                                    <span
                                                        class="text-muted-foreground truncate text-[15px] leading-relaxed"
                                                    >
                                                        {item.wr_content || item.wr_subject}
                                                    </span>
                                                {:else}
                                                    <span
                                                        class="text-foreground truncate text-[15px] font-medium leading-relaxed"
                                                    >
                                                        {item.wr_subject}
                                                    </span>
                                                    {#if item.wr_comment > 0}
                                                        <span
                                                            class="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                                        >
                                                            {formatCommentCountBadge(
                                                                item.wr_comment
                                                            )}
                                                        </span>
                                                    {/if}
                                                {/if}
                                            </div>

                                            <div class="hidden shrink-0 items-center gap-2 md:flex">
                                                <span
                                                    class="text-muted-foreground w-[100px] truncate text-sm"
                                                >
                                                    {item.wr_name}
                                                </span>
                                                <span
                                                    class="text-muted-foreground w-[65px] text-center text-sm"
                                                >
                                                    {formatTime(item.bn_datetime)}
                                                </span>
                                                <span
                                                    class="text-muted-foreground flex w-[50px] items-center justify-end gap-1 text-sm"
                                                >
                                                    <Eye class="h-3.5 w-3.5" />
                                                    {item.wr_hit.toLocaleString()}
                                                </span>
                                            </div>

                                            <div
                                                class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm md:hidden"
                                            >
                                                <span
                                                    class="bg-muted rounded px-1.5 py-0.5 text-xs font-medium"
                                                >
                                                    {item.bo_subject}
                                                </span>
                                                <span>{item.wr_name}</span>
                                                <span class="text-border">·</span>
                                                <span>{formatTime(item.bn_datetime)}</span>
                                                {#if !isComment(item) && item.wr_hit > 0}
                                                    <span class="text-border">·</span>
                                                    <span class="flex items-center gap-0.5">
                                                        <Eye class="h-3 w-3" />
                                                        {item.wr_hit.toLocaleString()}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- 페이지네이션 -->
        {@const totalPages = Math.ceil(result.total / data.perPage)}
        {#if totalPages > 1}
            <div class="mt-6 flex items-center justify-center gap-1.5">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                    class="h-9 px-3 transition-all duration-200"
                >
                    이전
                </Button>

                {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const startPage = Math.max(1, data.page - 2);
                    return startPage + i;
                }) as pageNum (pageNum)}
                    {#if pageNum <= totalPages}
                        <Button
                            variant={pageNum === data.page ? 'default' : 'outline'}
                            size="sm"
                            onclick={() =>
                                goToPage(pageNum, pageNum > data.page ? result.nextCursor : null)}
                            class="h-9 w-9 p-0 transition-all duration-200"
                        >
                            {pageNum}
                        </Button>
                    {/if}
                {/each}

                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === totalPages}
                    onclick={() => goToPage(data.page + 1, result.nextCursor)}
                    class="h-9 px-3 transition-all duration-200"
                >
                    다음
                </Button>
            </div>

            <p class="text-muted-foreground mt-3 text-center text-sm">
                {data.page} / {totalPages} 페이지
            </p>
        {/if}
    {:catch}
        <!-- 에러 상태 -->
        <Card class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
            <CardContent class="py-16 text-center">
                <div
                    class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                >
                    <Newspaper class="text-muted-foreground h-8 w-8" />
                </div>
                <p class="text-foreground mb-1 text-lg font-medium">데이터를 불러올 수 없습니다</p>
                <p class="text-muted-foreground text-sm">잠시 후 다시 시도해주세요.</p>
            </CardContent>
        </Card>
    {/await}
</div>
