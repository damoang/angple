<script lang="ts">
    import { onMount } from 'svelte';
    import { SvelteMap } from 'svelte/reactivity';
    import type { RecommendedDataWithAI, RecommendedPeriod } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import { RecommendedHeader } from './components/header';
    import { RecommendedTabs } from './components/tabs';
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
            // PHP 크론이 생성한 JSON 캐시 파일을 SvelteKit API를 통해 읽음
            const res = await fetch(`/api/widgets/recommended/data?period=${period}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const newData: RecommendedDataWithAI = await res.json();
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
    <CardHeader class="flex flex-row items-center justify-between space-y-0 px-4 py-3">
        <RecommendedHeader />
        <RecommendedTabs bind:activeTab onTabChange={handleTabChange} />
    </CardHeader>

    <CardContent class="px-4">
        {#if loading}
            <SkeletonLoader />
        {:else if error}
            <div class="flex items-center justify-center py-8">
                <div class="text-center">
                    <p class="text-destructive text-sm">{error}</p>
                </div>
            </div>
        {:else if data}
            <PostList {data} />
        {/if}
    </CardContent>
</Card>
