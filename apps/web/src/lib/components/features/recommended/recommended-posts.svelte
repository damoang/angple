<script lang="ts">
    import { onMount } from 'svelte';
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

    async function loadData(period: RecommendedPeriod) {
        loading = true;
        error = null;
        try {
            data = await apiClient.getRecommendedPostsWithAI(period);
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
        loadData(activeTab);
    });
</script>

<Card class="gap-0">
    <CardHeader class="flex-row items-center justify-between space-y-0 pb-0">
        <RecommendedHeader />
        <RecommendedTabs bind:activeTab onTabChange={handleTabChange} />
    </CardHeader>

    <CardContent class="px-3">
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
