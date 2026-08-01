<script lang="ts">
    /**
     * 내가 신고한 목록 (SSR).
     *
     * ⛔ 처리 결과(인용/기각/처리중)는 표시하지 않는다 — "무엇을 신고했는지"까지만.
     *    신고자 통보 금지 원칙과의 충돌을 화면 설계에서 회피한 것으로, 서버도
     *    처리 컬럼을 아예 SELECT 하지 않는다($lib/server/my-reports.ts).
     */
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import Flag from '@lucide/svelte/icons/flag';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { getReportReasonLabel } from '$lib/utils/report-reasons.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const reports = $derived(data.reports);

    function formatDate(iso: string): string {
        const d = new Date(iso);
        return d.toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    function goToPage(pageNum: number): void {
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        goto(`/my/reports?${params.toString()}`);
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
    <title>신고 내역 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<Card class="border-border bg-background rounded-xl border shadow-sm">
    <CardHeader class="border-border border-b px-4 py-4">
        <div class="flex items-center gap-3">
            <div class="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Flag class="text-primary h-5 w-5" />
            </div>
            <div>
                <CardTitle class="text-xl leading-tight">신고 내역</CardTitle>
                <p class="text-muted-foreground text-sm">
                    회원님이 신고하신 내역 {reports.total.toLocaleString()}건입니다.
                </p>
            </div>
        </div>
    </CardHeader>

    <CardContent class="p-0">
        {#if reports.error}
            <div class="py-16 text-center">
                <p class="text-foreground mb-1 text-lg font-medium">
                    신고 내역을 불러오지 못했습니다
                </p>
                <p class="text-muted-foreground text-sm">잠시 후 다시 시도해 주세요.</p>
            </div>
        {:else if reports.items.length === 0}
            <div class="py-16 text-center">
                <div
                    class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                >
                    <Flag class="text-muted-foreground h-8 w-8" />
                </div>
                <p class="text-foreground mb-1 text-lg font-medium">신고하신 내역이 없습니다</p>
            </div>
        {:else}
            <ul class="divide-border divide-y">
                {#each reports.items as item (item.boardId + ':' + item.targetId)}
                    <li class="px-4 py-3">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="text-muted-foreground shrink-0 text-xs">
                                        [{item.boardName}]
                                    </span>
                                    {#if item.targetType === 'comment'}
                                        <MessageSquare
                                            class="text-muted-foreground h-3.5 w-3.5 shrink-0"
                                        />
                                    {/if}
                                    {#if item.href}
                                        <a
                                            href={item.href}
                                            class="text-foreground hover:text-primary truncate text-sm font-medium"
                                        >
                                            {item.title}
                                        </a>
                                    {:else}
                                        <!-- 삭제·비밀 대상은 링크를 걸지 않는다 -->
                                        <span class="text-muted-foreground truncate text-sm">
                                            {item.title}
                                        </span>
                                    {/if}
                                    {#if item.targetType === 'comment'}
                                        <span class="text-muted-foreground shrink-0 text-xs">
                                            글의 댓글{item.commentDeleted ? ' (삭제됨)' : ''}
                                        </span>
                                    {/if}
                                </div>
                                <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    {#each item.reasonCodes as code (code)}
                                        <Badge variant="outline" class="text-xs font-normal">
                                            {getReportReasonLabel(code)}
                                        </Badge>
                                    {/each}
                                </div>
                                {#if item.detail}
                                    <p class="text-muted-foreground mt-1.5 line-clamp-2 text-xs">
                                        {item.detail}
                                    </p>
                                {/if}
                            </div>
                            <time
                                datetime={item.reportedAt}
                                class="text-muted-foreground shrink-0 text-xs"
                            >
                                {formatDate(item.reportedAt)}
                            </time>
                        </div>
                    </li>
                {/each}
            </ul>

            {#if reports.totalPages > 1}
                <div
                    class="border-border flex items-center justify-center gap-1 border-t px-4 py-4"
                >
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-8 w-8 p-0"
                        disabled={reports.page <= 1}
                        onclick={() => goToPage(reports.page - 1)}
                        aria-label="이전 페이지"
                    >
                        <ChevronLeft class="h-4 w-4" />
                    </Button>
                    {#each getPageNumbers(reports.page, reports.totalPages) as p, i (String(p) + i)}
                        {#if p === '...'}
                            <span class="text-muted-foreground px-1 text-sm">…</span>
                        {:else}
                            <Button
                                variant={p === reports.page ? 'default' : 'outline'}
                                size="sm"
                                class="h-8 w-8 p-0"
                                onclick={() => goToPage(p)}
                            >
                                {p}
                            </Button>
                        {/if}
                    {/each}
                    <Button
                        variant="outline"
                        size="sm"
                        class="h-8 w-8 p-0"
                        disabled={reports.page >= reports.totalPages}
                        onclick={() => goToPage(reports.page + 1)}
                        aria-label="다음 페이지"
                    >
                        <ChevronRight class="h-4 w-4" />
                    </Button>
                </div>
            {/if}
        {/if}
    </CardContent>
</Card>
