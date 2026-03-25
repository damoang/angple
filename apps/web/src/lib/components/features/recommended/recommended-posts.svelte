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

    interface Props {
        /** SSR prefetch 데이터 (있으면 즉시 표시, 없으면 클라이언트 fetch) */
        prefetchData?: { data: RecommendedDataWithAI; period: RecommendedPeriod } | unknown;
    }

    const { prefetchData }: Props = $props();

    const { defaultTab } = getCurrentTabVisibility();

    // SSR 데이터가 있으면 즉시 사용
    const ssrData = prefetchData as
        | { data: RecommendedDataWithAI; period: RecommendedPeriod }
        | undefined;
    const hasSSRData = !!ssrData?.data;

    // 마지막 선택 탭 복원 (localStorage > SSR period > 시간대 기본값)
    function getSavedTab(): RecommendedPeriod | null {
        if (typeof window === 'undefined') return null;
        try {
            const saved = localStorage.getItem(
                'angple_recommended_tab'
            ) as RecommendedPeriod | null;
            if (saved && ['1h', '3h', '6h', '12h', '24h', '48h'].includes(saved)) {
                return saved;
            }
        } catch {
            /* ignore */
        }
        return null;
    }

    const savedTab = getSavedTab();
    const initialTab = savedTab ?? (hasSSRData ? ssrData!.period : defaultTab);
    // SSR 데이터가 초기 탭과 같은 period인 경우에만 즉시 사용
    const canUseSSR = hasSSRData && ssrData!.period === initialTab;

    let activeTab = $state<RecommendedPeriod>(initialTab);
    let data = $state<RecommendedDataWithAI | null>(canUseSSR ? ssrData!.data : null);
    let loading = $state(!canUseSSR);
    let error = $state<string | null>(null);

    // 탭별 데이터 캐시
    const dataCache = new SvelteMap<RecommendedPeriod, RecommendedDataWithAI>();

    // SSR 데이터를 캐시에 등록
    if (hasSSRData) {
        dataCache.set(ssrData!.period, ssrData!.data);
    }

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
        // 탭 선택 저장 (뒤로가기 시 복원)
        try {
            localStorage.setItem('angple_recommended_tab', tabId);
        } catch {
            /* ignore */
        }
    }

    function prefetchPeriod(period: RecommendedPeriod) {
        if (dataCache.has(period)) return;

        fetch(`/api/widgets/recommended/data?period=${period}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((nextData) => {
                if (nextData) {
                    dataCache.set(period, nextData as RecommendedDataWithAI);
                }
            })
            .catch(() => {});
    }

    function prefetchNeighborTabs(period: RecommendedPeriod) {
        const allPeriods: RecommendedPeriod[] = ['1h', '3h', '6h', '12h', '24h', '48h'];
        const currentIndex = allPeriods.indexOf(period);
        if (currentIndex === -1) return;

        const candidates = [allPeriods[currentIndex - 1], allPeriods[currentIndex + 1]].filter(
            (value): value is RecommendedPeriod => Boolean(value)
        );

        for (const candidate of candidates) {
            prefetchPeriod(candidate);
        }
    }

    onMount(() => {
        // SSR 데이터가 없거나 저장된 탭과 다르면 클라이언트에서 fetch
        if (!canUseSSR) {
            loadData(activeTab, true);
        }

        setTimeout(() => {
            prefetchNeighborTabs(activeTab);
        }, 500);
    });
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
        <RecommendedHeader />
        <RecommendedTabs bind:activeTab onTabChange={handleTabChange} />
    </CardHeader>

    <CardContent class="">
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
