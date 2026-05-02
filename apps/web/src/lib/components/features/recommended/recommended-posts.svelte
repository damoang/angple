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
    import { TimedFetchError, timedFetch } from '$lib/utils/timed-fetch';

    interface Props {
        /** SSR prefetch 데이터 (있으면 즉시 표시, 없으면 클라이언트 fetch) */
        prefetchData?: { data: RecommendedDataWithAI; period: RecommendedPeriod } | unknown;
    }

    const STORAGE_KEY = 'angple:recommended:data:v1';
    const STORAGE_TTL_MS = 5 * 60 * 1000;

    const { prefetchData }: Props = $props();

    const { defaultTab } = getCurrentTabVisibility();

    // SSR 데이터가 있으면 즉시 사용
    const ssrData = prefetchData as
        | { data: RecommendedDataWithAI; period: RecommendedPeriod }
        | undefined;
    const hasSSRData = !!ssrData?.data;

    // SSR 데이터가 있으면 SSR period로 시작 (스켈레톤 방지)
    // 클라이언트 복귀 시 sessionStorage에서 이전 탭 복원 (뒤로가기 대응)
    const savedTab =
        typeof window !== 'undefined'
            ? (sessionStorage.getItem('recommended_active_tab') as RecommendedPeriod | null)
            : null;
    const initialTab =
        savedTab || (hasSSRData ? (ssrData!.period as RecommendedPeriod) : defaultTab);
    const canUseSSR = hasSSRData;

    let activeTab = $state<RecommendedPeriod>(initialTab);
    let data = $state<RecommendedDataWithAI | null>(canUseSSR ? ssrData!.data : null);
    let loading = $state(!canUseSSR);
    let error = $state<string | null>(null);

    // 탭별 데이터 캐시
    const dataCache = new SvelteMap<RecommendedPeriod, RecommendedDataWithAI>();

    function hydrateCacheFromSessionStorage() {
        if (typeof window === 'undefined') return;

        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return;

            const parsed = JSON.parse(raw) as Record<
                string,
                { data: RecommendedDataWithAI; expiresAt: number }
            >;
            const now = Date.now();

            for (const [period, entry] of Object.entries(parsed)) {
                if (!entry || typeof entry !== 'object' || entry.expiresAt <= now || !entry.data) {
                    continue;
                }
                if (['1h', '3h', '6h', '12h', '24h', '48h'].includes(period)) {
                    dataCache.set(period as RecommendedPeriod, entry.data);
                }
            }
        } catch {
            /* ignore */
        }
    }

    function persistCacheToSessionStorage() {
        if (typeof window === 'undefined') return;

        try {
            const now = Date.now();
            const payload: Record<string, { data: RecommendedDataWithAI; expiresAt: number }> = {};

            for (const [period, value] of dataCache.entries()) {
                payload[period] = { data: value, expiresAt: now + STORAGE_TTL_MS };
            }

            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch {
            /* ignore */
        }
    }

    // SSR 데이터를 캐시에 등록
    if (hasSSRData) {
        dataCache.set(ssrData!.period, ssrData!.data);
    }

    hydrateCacheFromSessionStorage();

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
            // timed-fetch: 12s 타임아웃 + 1회 retry → skeleton 영구 대기 방지 (audit 2-1)
            const res = await timedFetch(
                `/api/widgets/recommended/data?period=${period}`,
                {},
                { timeout: 12_000, retries: 1, throwOnHTTPError: true }
            );
            const newData: RecommendedDataWithAI = await res.json();
            dataCache.set(period, newData);
            persistCacheToSessionStorage();
            // 현재 선택된 탭의 데이터만 업데이트
            if (activeTab === period) {
                data = newData;
            }
        } catch (err) {
            if (err instanceof TimedFetchError) {
                if (err.kind === 'timeout') {
                    error = '응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';
                } else if (err.kind === 'network') {
                    error = '네트워크 오류로 불러오지 못했어요.';
                } else if (err.kind === 'http') {
                    error = `데이터를 불러오지 못했어요 (HTTP ${err.status ?? '?'})`;
                } else {
                    error = '요청이 취소되었어요.';
                }
            } else {
                error = err instanceof Error ? err.message : '데이터 로드 실패';
            }
            console.error('추천 글 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    function retryLoad() {
        // 캐시 무효화 후 현재 탭 재시도
        dataCache.delete(activeTab);
        loadData(activeTab, true);
    }

    function handleTabChange(tabId: RecommendedPeriod) {
        activeTab = tabId;
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('recommended_active_tab', tabId);
        }
        loadData(tabId);
    }

    onMount(() => {
        if (!canUseSSR) {
            loadData(activeTab, true);
        } else if (savedTab && savedTab !== ssrData?.period) {
            // SSR 데이터와 복원된 탭이 다르면 해당 탭 데이터 fetch
            loadData(savedTab);
        }
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
                    <button
                        type="button"
                        class="text-primary mt-2 text-xs underline-offset-2 hover:underline"
                        onclick={retryLoad}
                    >
                        다시 불러오기
                    </button>
                </div>
            </div>
        {:else if data}
            <PostList {data} />
        {:else}
            <div class="flex items-center justify-center py-8">
                <p class="text-muted-foreground text-sm">데이터를 불러오지 못했어요</p>
            </div>
        {/if}
    </CardContent>
</Card>
