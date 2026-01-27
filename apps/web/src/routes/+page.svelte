<script lang="ts">
    import { onMount } from 'svelte';
    import { WidgetEditor } from '$lib/components/features/widget-editor';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { apiClient } from '$lib/api';
    import type {
        IndexWidgetsData,
        NewsPost,
        EconomyPost,
        GalleryPost,
        GroupTabsData
    } from '$lib/api/types';

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

    // 위젯 레이아웃 스토어 초기화 (메인 + 사이드바)
    widgetLayoutStore.initFromServer(data.widgetLayout, data.sidebarWidgetLayout);

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
<!-- 관리자는 편집 모드로 위젯 순서를 변경할 수 있습니다 -->
<WidgetEditor {newsTabs} {economyTabs} {gallery} {groupTabs} />
