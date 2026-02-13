<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { GivingStatus } from '../types/giving.js';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import Flame from '@lucide/svelte/icons/flame';
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

    interface Zone {
        start: number;
        end: number;
        avgCount: number;
    }

    let distribution = $state<NumberDistribution[]>([]);
    let isLoading = $state(true);
    let errorMsg = $state('');

    const isVisible = $derived(status === 'ended');

    // 경쟁 구간 분석 (연속 3개 이상 count >= 3인 번호 범위)
    const competitionZones = $derived(() => {
        const zones: Zone[] = [];
        let currentZone: NumberDistribution[] = [];

        for (const item of distribution) {
            if (item.count >= 3) {
                currentZone.push(item);
            } else {
                if (currentZone.length >= 3) {
                    zones.push({
                        start: currentZone[0].number,
                        end: currentZone[currentZone.length - 1].number,
                        avgCount:
                            currentZone.reduce((sum, d) => sum + d.count, 0) / currentZone.length
                    });
                }
                currentZone = [];
            }
        }
        if (currentZone.length >= 3) {
            zones.push({
                start: currentZone[0].number,
                end: currentZone[currentZone.length - 1].number,
                avgCount: currentZone.reduce((sum, d) => sum + d.count, 0) / currentZone.length
            });
        }

        return zones;
    });

    // 안전 구간 분석 (연속 3개 이상 count <= 1인 번호 범위)
    const safeZones = $derived(() => {
        const zones: Zone[] = [];
        let currentZone: NumberDistribution[] = [];

        for (const item of distribution) {
            if (item.count <= 1) {
                currentZone.push(item);
            } else {
                if (currentZone.length >= 3) {
                    zones.push({
                        start: currentZone[0].number,
                        end: currentZone[currentZone.length - 1].number,
                        avgCount:
                            currentZone.reduce((sum, d) => sum + d.count, 0) / currentZone.length
                    });
                }
                currentZone = [];
            }
        }
        if (currentZone.length >= 3) {
            zones.push({
                start: currentZone[0].number,
                end: currentZone[currentZone.length - 1].number,
                avgCount: currentZone.reduce((sum, d) => sum + d.count, 0) / currentZone.length
            });
        }

        return zones;
    });

    // 전체 통계
    const totalBids = $derived(distribution.reduce((sum, d) => sum + d.count, 0));
    const uniqueCount = $derived(distribution.filter((d) => d.count === 1).length);
    const unselectedCount = $derived(distribution.filter((d) => d.count === 0).length);
    const avgBidsPerNumber = $derived(
        distribution.length > 0 ? totalBids / distribution.length : 0
    );

    onMount(async () => {
        if (!isVisible) return;
        await loadData();
    });

    async function loadData() {
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
            errorMsg = '분석 데이터 로드에 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }
</script>

{#if isVisible}
    <Card>
        <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-2 text-base">
                <TrendingUp class="h-4 w-4" />
                경쟁 분석
            </CardTitle>
        </CardHeader>

        <CardContent>
            {#if isLoading}
                <div class="text-muted-foreground py-4 text-center text-sm">분석 중...</div>
            {:else if errorMsg}
                <p class="text-destructive py-4 text-center text-sm">{errorMsg}</p>
            {:else if distribution.length === 0}
                <p class="text-muted-foreground py-4 text-center text-sm">
                    분석할 데이터가 없습니다.
                </p>
            {:else}
                <!-- 전체 통계 -->
                <div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div class="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div class="text-muted-foreground text-xs">총 응모 수</div>
                        <div class="text-sm font-bold">{totalBids}</div>
                    </div>
                    <div class="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div class="text-muted-foreground text-xs">번호당 평균</div>
                        <div class="text-sm font-bold">{avgBidsPerNumber.toFixed(1)}</div>
                    </div>
                    <div class="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div class="text-muted-foreground text-xs">고유 번호</div>
                        <div class="text-sm font-bold text-green-600 dark:text-green-400">
                            {uniqueCount}
                        </div>
                    </div>
                    <div class="bg-muted/50 rounded-lg p-2.5 text-center">
                        <div class="text-muted-foreground text-xs">미선택 번호</div>
                        <div class="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {unselectedCount}
                        </div>
                    </div>
                </div>

                <!-- 경쟁 구간 -->
                {#if competitionZones().length > 0}
                    <div class="mb-3">
                        <h4 class="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                            <Flame class="h-3.5 w-3.5 text-red-500" />
                            경쟁 과열 구간
                        </h4>
                        <div class="space-y-1.5">
                            {#each competitionZones() as zone}
                                <div
                                    class="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-950/30"
                                >
                                    <span class="text-sm font-medium">
                                        {zone.start} ~ {zone.end}번
                                    </span>
                                    <Badge variant="destructive" class="text-xs">
                                        평균 {zone.avgCount.toFixed(1)}명
                                    </Badge>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- 안전 구간 -->
                {#if safeZones().length > 0}
                    <div>
                        <h4 class="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                            <ShieldCheck class="h-3.5 w-3.5 text-green-500" />
                            안전 구간
                        </h4>
                        <div class="space-y-1.5">
                            {#each safeZones() as zone}
                                <div
                                    class="flex items-center justify-between rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950/30"
                                >
                                    <span class="text-sm font-medium">
                                        {zone.start} ~ {zone.end}번
                                    </span>
                                    <Badge class="bg-green-600 text-xs text-white">
                                        평균 {zone.avgCount.toFixed(1)}명
                                    </Badge>
                                </div>
                            {/each}
                        </div>
                    </div>
                {:else if competitionZones().length === 0}
                    <p class="text-muted-foreground text-center text-sm">
                        뚜렷한 경쟁/안전 구간이 없습니다.
                    </p>
                {/if}
            {/if}
        </CardContent>
    </Card>
{/if}
