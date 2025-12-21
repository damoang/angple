<script lang="ts">
    import { onMount } from 'svelte';
    import { SvelteMap } from 'svelte/reactivity';
    import { apiClient } from '$lib/api';
    import type { RecommendedDataWithAI, RecommendedPeriod } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import { RecommendedHeader } from './components/header';
    import { RecommendedTabs } from './components/tabs';
    import { AITrendCard } from './components/ai-trend';
    import { PostList } from './components/post-list';
    import { SkeletonLoader } from './components/loading';
    import { getCurrentTabVisibility } from './utils/index.js';

    const { defaultTab } = getCurrentTabVisibility();

    let activeTab = $state<RecommendedPeriod>(defaultTab);
    let data = $state<RecommendedDataWithAI | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 탭별 데이터 캐시
    const dataCache = new SvelteMap<RecommendedPeriod, RecommendedDataWithAI>();

    async function loadData(period: RecommendedPeriod, isInitial = false) {
        // 캐시에 데이터가 있으면 즉시 표시
        if (dataCache.has(period)) {
            data = dataCache.get(period)!;
            return;
        }

        // 초기 로드시에만 로딩 표시 (탭 전환시에는 기존 데이터 유지)
        if (isInitial) {
            loading = true;
        }
        error = null;

        try {
            const newData = await apiClient.getRecommendedPostsWithAI(period);
            dataCache.set(period, newData);
            // 현재 선택된 탭의 데이터만 업데이트
            if (activeTab === period) {
                data = newData;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : '데이터 로드 실패';
            console.error('추천 글 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    function handleTabChange(tabId: RecommendedPeriod) {
        activeTab = tabId;
        loadData(tabId);
    }

    onMount(() => {
        loadData(activeTab, true);
    });
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 px-4 py-2.5">
        <RecommendedHeader />
        <RecommendedTabs bind:activeTab onTabChange={handleTabChange} />
    </CardHeader>

    <CardContent class="px-4">
        {#if loading}
            <SkeletonLoader />
        {:else if error}
            <div class="flex items-center justify-center py-8">
                <div class="text-center">
                    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        {:else if data}
            {#if data.ai_analysis}
                <AITrendCard analysis={data.ai_analysis} />
            {/if}
            <PostList {data} />
        {/if}
    </CardContent>
</Card>
