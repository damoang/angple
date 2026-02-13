<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import type { GivingStatus } from '../types/giving.js';
    import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
    import { onMount } from 'svelte';

    let {
        postId,
        status = 'ended' as GivingStatus
    }: {
        postId: number;
        status?: GivingStatus;
    } = $props();

    interface NumberDistribution {
        number: number;
        count: number;
    }

    let distribution = $state<NumberDistribution[]>([]);
    let isLoading = $state(true);
    let errorMsg = $state('');

    const maxCount = $derived(
        distribution.length > 0 ? Math.max(...distribution.map((d) => d.count)) : 1
    );

    // 종료된 나눔에서만 표시
    const isVisible = $derived(status === 'ended');

    onMount(async () => {
        if (!isVisible) return;
        await loadVisualization();
    });

    async function loadVisualization() {
        isLoading = true;
        errorMsg = '';
        try {
            const res = await fetch(`/api/plugins/giving/${postId}/visualization`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    distribution = data.data.distribution || [];
                }
            } else {
                errorMsg = '데이터를 불러올 수 없습니다.';
            }
        } catch {
            errorMsg = '시각화 데이터 로드에 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }

    function getBarColor(count: number): string {
        if (count === 1) return 'bg-green-500 dark:bg-green-400';
        if (count === 0) return 'bg-gray-300 dark:bg-gray-600';
        if (count >= 5) return 'bg-red-500 dark:bg-red-400';
        if (count >= 3) return 'bg-orange-500 dark:bg-orange-400';
        return 'bg-yellow-500 dark:bg-yellow-400';
    }

    function getBarLabel(count: number): string {
        if (count === 1) return '고유';
        if (count === 0) return '미선택';
        return `${count}명`;
    }
</script>

{#if isVisible}
    <Card>
        <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-2 text-base">
                <BarChart3 class="h-4 w-4" />
                응모 번호 분포
            </CardTitle>
        </CardHeader>

        <CardContent>
            {#if isLoading}
                <div class="text-muted-foreground py-4 text-center text-sm">불러오는 중...</div>
            {:else if errorMsg}
                <p class="text-destructive py-4 text-center text-sm">{errorMsg}</p>
            {:else if distribution.length === 0}
                <p class="text-muted-foreground py-4 text-center text-sm">
                    응모 데이터가 없습니다.
                </p>
            {:else}
                <!-- 범례 -->
                <div class="mb-4 flex flex-wrap gap-3 text-xs">
                    <div class="flex items-center gap-1.5">
                        <span class="inline-block h-2.5 w-2.5 rounded-sm bg-green-500"></span>
                        <span class="text-muted-foreground">고유 번호 (1명)</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-500"></span>
                        <span class="text-muted-foreground">2명</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500"></span>
                        <span class="text-muted-foreground">3-4명</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <span class="inline-block h-2.5 w-2.5 rounded-sm bg-red-500"></span>
                        <span class="text-muted-foreground">5명 이상 (경쟁 과열)</span>
                    </div>
                </div>

                <!-- 바 차트 -->
                <div class="max-h-96 space-y-1.5 overflow-y-auto">
                    {#each distribution as item (item.number)}
                        <div class="flex items-center gap-2">
                            <span
                                class="text-muted-foreground w-8 text-right text-xs font-medium tabular-nums"
                            >
                                {item.number}
                            </span>
                            <div class="bg-muted/30 h-5 flex-1 overflow-hidden rounded">
                                <div
                                    class="h-full rounded transition-all {getBarColor(item.count)}"
                                    style="width: {maxCount > 0
                                        ? Math.max(
                                              (item.count / maxCount) * 100,
                                              item.count > 0 ? 4 : 0
                                          )
                                        : 0}%"
                                ></div>
                            </div>
                            <span
                                class="w-12 text-xs tabular-nums {item.count === 1
                                    ? 'font-semibold text-green-600 dark:text-green-400'
                                    : 'text-muted-foreground'}"
                            >
                                {getBarLabel(item.count)}
                            </span>
                        </div>
                    {/each}
                </div>

                <!-- 통계 요약 -->
                <div class="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
                    <div class="text-center">
                        <div class="text-muted-foreground text-xs">전체 번호</div>
                        <div class="text-sm font-semibold">{distribution.length}</div>
                    </div>
                    <div class="text-center">
                        <div class="text-muted-foreground text-xs">고유 번호</div>
                        <div class="text-sm font-semibold text-green-600 dark:text-green-400">
                            {distribution.filter((d) => d.count === 1).length}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-muted-foreground text-xs">경쟁 번호</div>
                        <div class="text-sm font-semibold text-red-600 dark:text-red-400">
                            {distribution.filter((d) => d.count >= 2).length}
                        </div>
                    </div>
                </div>
            {/if}
        </CardContent>
    </Card>
{/if}
