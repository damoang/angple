<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { PageData } from './$types.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { PointHistoryResponse } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import Coins from '@lucide/svelte/icons/coins';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import TrendingDown from '@lucide/svelte/icons/trending-down';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    let { data }: { data: PageData } = $props();

    // 상태
    let pointData = $state<PointHistoryResponse | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // 포인트 데이터 로드
    onMount(async () => {
        // 로그인 체크
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        try {
            pointData = await apiClient.getPointHistory(data.page, data.limit);
        } catch (err) {
            error = err instanceof Error ? err.message : '포인트 내역을 불러오는데 실패했습니다.';
        } finally {
            isLoading = false;
        }
    });

    // 날짜 포맷
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

    // 포인트 포맷 (양수는 +, 음수는 그대로)
    function formatPoint(point: number): string {
        if (point > 0) {
            return `+${point.toLocaleString()}`;
        }
        return point.toLocaleString();
    }

    // 페이지 변경
    function goToPage(pageNum: number): void {
        goto(`/my/points?page=${pageNum}`);
    }
</script>

<svelte:head>
    <title>포인트 내역 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <!-- 헤더 -->
    <div class="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onclick={() => goto('/my')}>
            <ArrowLeft class="mr-1 h-4 w-4" />
            마이페이지
        </Button>
        <h1 class="text-foreground text-2xl font-bold">포인트 내역</h1>
    </div>

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
    {:else if pointData}
        <!-- 포인트 요약 -->
        <div class="mb-6 grid gap-4 sm:grid-cols-3">
            <!-- 현재 보유 포인트 -->
            <Card class="bg-primary/5 border-primary/20">
                <CardContent class="pt-6">
                    <div class="flex items-center gap-3">
                        <div class="bg-primary/10 rounded-full p-3">
                            <Coins class="text-primary h-6 w-6" />
                        </div>
                        <div>
                            <p class="text-muted-foreground text-sm">보유 포인트</p>
                            <p class="text-foreground text-2xl font-bold">
                                {pointData.summary.total_point.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- 총 적립 -->
            <Card>
                <CardContent class="pt-6">
                    <div class="flex items-center gap-3">
                        <div class="rounded-full bg-green-500/10 p-3">
                            <TrendingUp class="h-6 w-6 text-green-500" />
                        </div>
                        <div>
                            <p class="text-muted-foreground text-sm">총 적립</p>
                            <p class="text-2xl font-bold text-green-600">
                                +{pointData.summary.total_earned.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <!-- 총 사용 -->
            <Card>
                <CardContent class="pt-6">
                    <div class="flex items-center gap-3">
                        <div class="rounded-full bg-red-500/10 p-3">
                            <TrendingDown class="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                            <p class="text-muted-foreground text-sm">총 사용</p>
                            <p class="text-2xl font-bold text-red-600">
                                {pointData.summary.total_used.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- 포인트 내역 목록 -->
        <Card class="bg-background">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    포인트 내역
                    <span class="text-muted-foreground text-sm font-normal">
                        ({pointData.total}건)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if pointData.items.length > 0}
                    <ul class="divide-border divide-y">
                        {#each pointData.items as item (item.id)}
                            <li class="py-3 first:pt-0 last:pb-0">
                                <div class="flex items-center justify-between gap-4">
                                    <div class="min-w-0 flex-1">
                                        <p class="text-foreground truncate font-medium">
                                            {item.po_content}
                                        </p>
                                        <div
                                            class="text-muted-foreground mt-1 flex items-center gap-2 text-xs"
                                        >
                                            <span>{formatDate(item.po_datetime)}</span>
                                            {#if item.po_expired}
                                                <span class="text-destructive">(만료됨)</span>
                                            {:else if item.po_expire_date && item.po_expire_date !== '9999-12-31'}
                                                <span>만료: {item.po_expire_date}</span>
                                            {/if}
                                        </div>
                                    </div>
                                    <div
                                        class="shrink-0 text-lg font-bold {item.po_point > 0
                                            ? 'text-green-600'
                                            : 'text-red-600'}"
                                    >
                                        {formatPoint(item.po_point)}
                                    </div>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p class="text-muted-foreground py-8 text-center">포인트 내역이 없습니다.</p>
                {/if}
            </CardContent>
        </Card>

        <!-- 페이지네이션 -->
        {#if pointData.total_pages > 1}
            <div class="mt-6 flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                >
                    이전
                </Button>

                <span class="text-muted-foreground px-4 text-sm">
                    {data.page} / {pointData.total_pages}
                </span>

                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === pointData.total_pages}
                    onclick={() => goToPage(data.page + 1)}
                >
                    다음
                </Button>
            </div>
        {/if}
    {/if}
</div>
