<script lang="ts">
    /**
     * 이용제한 기록 목록 페이지
     */
    import { goto } from '$app/navigation';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import { getPenaltyDisplay } from '$lib/api/discipline-log.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const logs = $derived(data.logs || []);
    const total = $derived(data.total || 0);
    const currentPage = $derived(data.page || 1);
    const pageSize = 20;
    const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

    function goToPage(page: number) {
        if (page < 1 || page > totalPages) return;
        const url = new URL(window.location.href);
        url.searchParams.set('page', String(page));
        goto(url.pathname + url.search);
    }

    function getPenaltyBadgeVariant(
        period: number,
        released: boolean
    ): 'default' | 'secondary' | 'destructive' | 'outline' {
        if (released) return 'secondary';
        if (period === -1) return 'destructive';
        if (period === 0) return 'secondary';
        return 'destructive';
    }

    function isToday(dateStr: string): boolean {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return dateStr === `${yyyy}-${mm}-${dd}`;
    }
</script>

<svelte:head>
    <title>이용제한 기록</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-6">
    <Card.Root>
        <Card.Header>
            <Card.Title class="flex items-center gap-2">
                <AlertTriangle class="text-destructive h-5 w-5" />
                이용제한 기록
            </Card.Title>
            <Card.Description>규정을 위반한 회원에 대한 제재 기록입니다.</Card.Description>
        </Card.Header>
        <Card.Content>
            {#if logs.length === 0}
                <div class="text-muted-foreground flex flex-col items-center justify-center py-12">
                    <p>이용제한 기록이 없습니다.</p>
                </div>
            {:else}
                <!-- Desktop table -->
                <div class="hidden overflow-x-auto md:block">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-muted/50 border-b">
                                <th class="p-3 text-left font-medium">닉네임</th>
                                <th class="p-3 text-left font-medium">아이디</th>
                                <th class="p-3 text-left font-medium">시작일</th>
                                <th class="p-3 text-center font-medium">기간</th>
                                <th class="p-3 text-left font-medium">사유</th>
                                <th class="p-3 text-left font-medium">메모</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each logs as log (log.id)}
                                {@const penalty = getPenaltyDisplay(
                                    log.penalty_period,
                                    log.penalty_date_to
                                )}
                                <tr
                                    class="hover:bg-muted/50 border-b transition-all duration-200 ease-out"
                                >
                                    <td class="p-3">
                                        <a
                                            href="/disciplinelog/{log.id}"
                                            class="{isToday(log.penalty_date_from)
                                                ? 'text-red-500'
                                                : 'text-foreground'} hover:text-primary font-medium hover:underline"
                                        >
                                            {log.member_nickname}
                                        </a>
                                    </td>
                                    <td class="text-muted-foreground p-3">{log.member_id}</td>
                                    <td class="text-muted-foreground p-3"
                                        >{log.penalty_date_from}</td
                                    >
                                    <td class="p-3 text-center">
                                        <Badge
                                            variant={getPenaltyBadgeVariant(
                                                log.penalty_period,
                                                penalty.released
                                            )}
                                        >
                                            {penalty.text}
                                        </Badge>
                                    </td>
                                    <td class="p-3">
                                        <div class="flex flex-wrap gap-1">
                                            {#each log.violation_titles.slice(0, 3) as title}
                                                <Badge variant="outline" class="text-xs"
                                                    >{title}</Badge
                                                >
                                            {/each}
                                            {#if log.violation_titles.length > 3}
                                                <Badge variant="outline" class="text-xs"
                                                    >+{log.violation_titles.length - 3}</Badge
                                                >
                                            {/if}
                                        </div>
                                    </td>
                                    <td
                                        class="text-muted-foreground max-w-[200px] truncate p-3 text-sm"
                                    >
                                        {log.memo || ''}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile cards -->
                <div class="space-y-3 md:hidden">
                    {#each logs as log (log.id)}
                        {@const penalty = getPenaltyDisplay(
                            log.penalty_period,
                            log.penalty_date_to
                        )}
                        <a href="/disciplinelog/{log.id}" class="block">
                            <div
                                class="hover:bg-muted/50 rounded-lg border p-4 transition-all duration-200 ease-out"
                            >
                                <div class="mb-2 flex items-center justify-between">
                                    <span
                                        class="font-medium {isToday(log.penalty_date_from)
                                            ? 'text-red-500'
                                            : ''}">{log.member_nickname}</span
                                    >
                                    <Badge
                                        variant={getPenaltyBadgeVariant(
                                            log.penalty_period,
                                            penalty.released
                                        )}
                                    >
                                        {penalty.text}
                                    </Badge>
                                </div>
                                <div class="text-muted-foreground mb-2 text-sm">
                                    {log.member_id} · {log.penalty_date_from}
                                </div>
                                <div class="flex flex-wrap gap-1">
                                    {#each log.violation_titles.slice(0, 2) as title}
                                        <Badge variant="outline" class="text-xs">{title}</Badge>
                                    {/each}
                                    {#if log.violation_titles.length > 2}
                                        <Badge variant="outline" class="text-xs"
                                            >+{log.violation_titles.length - 2}</Badge
                                        >
                                    {/if}
                                </div>
                                {#if log.memo}
                                    <div class="text-muted-foreground mt-1 truncate text-xs">
                                        {log.memo}
                                    </div>
                                {/if}
                            </div>
                        </a>
                    {/each}
                </div>

                <!-- Pagination -->
                {#if totalPages > 1}
                    <div class="mt-6 flex items-center justify-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            onclick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >
                            <ChevronLeft class="h-4 w-4" />
                        </Button>
                        {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                            return start + i;
                        }).filter((p) => p <= totalPages) as page}
                            <Button
                                variant={page === currentPage ? 'default' : 'outline'}
                                size="icon"
                                onclick={() => goToPage(page)}
                            >
                                {page}
                            </Button>
                        {/each}
                        <Button
                            variant="outline"
                            size="icon"
                            onclick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                        >
                            <ChevronRight class="h-4 w-4" />
                        </Button>
                    </div>
                {/if}
            {/if}
        </Card.Content>
    </Card.Root>
</div>
