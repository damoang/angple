<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Progress } from '$lib/components/ui/progress/index.js';
    import type { PageData } from './$types.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { ExpSummary, ExpHistoryResponse, ExpHistory } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import Star from '@lucide/svelte/icons/star';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import Award from '@lucide/svelte/icons/award';
    import Target from '@lucide/svelte/icons/target';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Plus from '@lucide/svelte/icons/plus';
    import Minus from '@lucide/svelte/icons/minus';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

    let { data }: { data: PageData } = $props();

    // 상태
    let expSummary = $state<ExpSummary | null>(null);
    let expHistory = $state<ExpHistoryResponse | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // 필터 탭 정의
    const filterTabs = [
        { key: 'all' as const, label: '전체' },
        { key: 'earned' as const, label: '획득' },
        { key: 'used' as const, label: '차감' }
    ];

    // 필터링된 아이템
    let filteredItems = $derived(() => {
        if (!expHistory) return [];
        if (data.filter === 'earned')
            return expHistory.items.filter((item) => item.exp_point > 0);
        if (data.filter === 'used')
            return expHistory.items.filter((item) => item.exp_point < 0);
        return expHistory.items;
    });

    // 경험치 요약 로드
    async function loadExpSummary(): Promise<void> {
        try {
            expSummary = await apiClient.getExpSummary();
        } catch (err) {
            console.error('Failed to load exp summary:', err);
        }
    }

    // 경험치 내역 로드
    async function loadExpHistory(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        isLoading = true;
        error = null;

        try {
            expHistory = await apiClient.getExpHistory(data.page, data.limit);
        } catch (err) {
            error = err instanceof Error ? err.message : '경험치 내역을 불러오는데 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }

    // 필터 변경
    function setFilter(filter: string): void {
        goto(`/my/exp?page=1&filter=${filter}`);
    }

    // 페이지 변경
    function goToPage(pageNum: number): void {
        goto(`/my/exp?page=${pageNum}&filter=${data.filter}`);
    }

    // 숫자 포맷
    function formatNumber(num: number): string {
        return num.toLocaleString('ko-KR');
    }

    // 시간 포맷
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 페이지네이션 번호 생성 (최대 5개, 현재 페이지 중심)
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

    // 초기 로드
    onMount(() => {
        loadExpSummary();
        loadExpHistory();
    });

    // 페이지 변경 시 내역 다시 로드
    $effect(() => {
        if (data.page) {
            loadExpHistory();
        }
    });
</script>

<svelte:head>
    <title>경험치 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <!-- 헤더 -->
    <div class="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onclick={() => goto('/my')}>
            <ArrowLeft class="mr-1 h-4 w-4" />
            마이페이지
        </Button>
        <h1 class="text-foreground flex items-center gap-2 text-2xl font-bold">
            <Star class="h-6 w-6 text-yellow-500" />
            경험치
        </h1>
    </div>

    <!-- 경험치 요약 카드 -->
    {#if expSummary}
        <div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <!-- 총 경험치 -->
            <Card>
                <CardContent class="pt-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-muted-foreground text-sm">총 경험치</p>
                            <p class="text-foreground text-2xl font-bold">
                                {formatNumber(expSummary.total_exp)}
                            </p>
                        </div>
                        <div
                            class="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30"
                        >
                            <Star class="h-6 w-6 text-yellow-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- 현재 레벨 -->
            <Card>
                <CardContent class="pt-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-muted-foreground text-sm">현재 레벨</p>
                            <p class="text-foreground text-2xl font-bold">
                                Lv.{expSummary.current_level}
                            </p>
                        </div>
                        <div
                            class="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30"
                        >
                            <Award class="h-6 w-6 text-purple-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- 다음 레벨까지 -->
            <Card>
                <CardContent class="pt-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-muted-foreground text-sm">다음 레벨까지</p>
                            <p class="text-foreground text-2xl font-bold">
                                {formatNumber(expSummary.next_level_exp)}
                            </p>
                        </div>
                        <div
                            class="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30"
                        >
                            <Target class="h-6 w-6 text-blue-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- 레벨 진행률 -->
            <Card>
                <CardContent class="pt-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-muted-foreground text-sm">레벨 진행률</p>
                            <p class="text-foreground text-2xl font-bold">
                                {expSummary.level_progress}%
                            </p>
                        </div>
                        <div
                            class="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
                        >
                            <TrendingUp class="h-6 w-6 text-green-500" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- 레벨 진행률 바 -->
        <Card class="mb-6">
            <CardContent class="pt-6">
                <div class="space-y-2">
                    <div class="flex items-center justify-between text-sm">
                        <span class="text-muted-foreground">Lv.{expSummary.current_level}</span>
                        <span class="text-muted-foreground">Lv.{expSummary.current_level + 1}</span>
                    </div>
                    <Progress value={expSummary.level_progress} max={100} class="h-3" />
                    <p class="text-muted-foreground text-center text-sm">
                        다음 레벨까지 <span class="text-foreground font-medium"
                            >{formatNumber(expSummary.next_level_exp)}</span
                        > 경험치 필요
                    </p>
                </div>
            </CardContent>
        </Card>
    {/if}

    <!-- 필터 탭 -->
    {#if !isLoading && !error && expHistory}
        <div class="mb-4 flex gap-2">
            {#each filterTabs as tab (tab.key)}
                <Button
                    variant={data.filter === tab.key ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => setFilter(tab.key)}
                >
                    {tab.label}
                </Button>
            {/each}
        </div>
    {/if}

    <!-- 경험치 내역 -->
    {#if isLoading}
        <div class="flex items-center justify-center py-20">
            <Loader2 class="text-primary h-8 w-8 animate-spin" />
        </div>
    {:else if error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{error}</p>
            </CardContent>
        </Card>
    {:else if expHistory}
        <Card class="bg-background">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    경험치 내역
                    <span class="text-muted-foreground text-sm font-normal">
                        ({filteredItems().length}건)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if filteredItems().length > 0}
                    <ul class="divide-border divide-y">
                        {#each filteredItems() as history (history.id)}
                            <li class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                                <div class="flex items-center gap-3">
                                    <!-- 증감 아이콘 -->
                                    <div
                                        class="flex h-8 w-8 items-center justify-center rounded-full {history.exp_point >
                                        0
                                            ? 'bg-green-100 dark:bg-green-900/30'
                                            : 'bg-red-100 dark:bg-red-900/30'}"
                                    >
                                        {#if history.exp_point > 0}
                                            <Plus class="h-4 w-4 text-green-500" />
                                        {:else}
                                            <Minus class="h-4 w-4 text-red-500" />
                                        {/if}
                                    </div>
                                    <div>
                                        <p class="text-foreground font-medium">
                                            {history.exp_content}
                                        </p>
                                        <p class="text-muted-foreground text-sm">
                                            {formatDate(history.exp_datetime)}
                                        </p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p
                                        class="font-bold {history.exp_point > 0
                                            ? 'text-green-600'
                                            : 'text-red-600'}"
                                    >
                                        {history.exp_point > 0 ? '+' : ''}{formatNumber(
                                            history.exp_point
                                        )}
                                    </p>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p class="text-muted-foreground py-8 text-center">경험치 내역이 없습니다.</p>
                {/if}
            </CardContent>
        </Card>

        <!-- 페이지네이션 -->
        {#if expHistory.total_pages > 1}
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

                {#each getPageNumbers(data.page, expHistory.total_pages) as pageNum}
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
                    disabled={data.page === expHistory.total_pages}
                    onclick={() => goToPage(data.page + 1)}
                >
                    다음
                    <ChevronRight class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    {/if}
</div>
