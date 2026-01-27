<script lang="ts">
    import { onMount } from 'svelte';
    import { RecommendedPosts } from '$lib/components/features/recommended';
    import { NewBoard } from '$lib/components/features/new-board';
    import { EconomyTabs } from '$lib/components/features/economy';
    import { GalleryGrid } from '$lib/components/features/gallery';
    import { GroupTabs } from '$lib/components/features/group';
    import { AdSlot } from '$lib/components/ui/ad-slot';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { apiClient } from '$lib/api';
    import type { IndexWidgetsData, NewsPost, EconomyPost, GalleryPost, GroupTabsData } from '$lib/api/types';

    const { data } = $props();

    // SSR 데이터를 로컬 상태로 관리 (반응형 보장)
    let widgetsData = $state<IndexWidgetsData | null>(data.indexWidgets);

    // 파생 데이터
    const newsTabs = $derived<NewsPost[]>(widgetsData?.news_tabs ?? []);
    const economyTabs = $derived<EconomyPost[]>(widgetsData?.economy_tabs ?? []);
    const gallery = $derived<GalleryPost[]>(widgetsData?.gallery ?? []);
    const groupTabs = $derived<GroupTabsData | null>(widgetsData?.group_tabs ?? null);

    // 스토어도 초기화 (다른 컴포넌트에서 사용할 수 있도록)
    indexWidgetsStore.initFromServer(data.indexWidgets);

    onMount(async () => {
        // SSR 데이터 없을 경우 클라이언트에서 fetch
        if (!widgetsData) {
            const fetchedData = await apiClient.getIndexWidgets();
            widgetsData = fetchedData;
            indexWidgetsStore.initFromServer(fetchedData);
        }
    });
</script>

<!-- 기본 커뮤니티 홈 콘텐츠 -->
<!-- corporate-landing 테마일 경우 레이아웃에서 렌더링을 대체함 -->
<div class="space-y-4">
    <!-- index-head: 상단 광고 -->
    <AdSlot position="index-head" height="90px" />

    <!-- 추천 글 위젯 -->
    <RecommendedPosts />

    <!-- index-top: 추천글 하단 광고 -->
    <AdSlot position="index-top" height="90px" />

    <!-- 새로운 소식 & 알뜰구매 (2열 그리드) -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NewBoard posts={newsTabs} />
        <EconomyTabs posts={economyTabs} />
    </div>

    <!-- index-middle-1: 중간 광고 1 -->
    <AdSlot position="index-middle-1" height="90px" />

    <!-- 갤러리 -->
    <GalleryGrid posts={gallery} />

    <!-- index-middle-2: 중간 광고 2 -->
    <AdSlot position="index-middle-2" height="90px" />

    <!-- 소모임 추천글 -->
    <GroupTabs data={groupTabs} />

    <!-- index-bottom: 하단 광고 -->
    <AdSlot position="index-bottom" height="90px" />
</div>
