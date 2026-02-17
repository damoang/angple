<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import { EditModeToggle } from '$lib/components/features/widget-editor';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { apiClient } from '$lib/api';
    import type { IndexWidgetsData } from '$lib/api/types';
    import { untrack } from 'svelte';
    import { SeoHead, createWebSiteJsonLd } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';

    const { data } = $props();

    // SSR 데이터를 로컬 상태로 관리 (반응형 보장)
    let widgetsData = $state<IndexWidgetsData | null>(null);

    // SSR 데이터 변경 시 로컬 상태 + 스토어 동기화
    $effect(() => {
        const widgets = data.indexWidgets;
        const layout = data.widgetLayout;
        const sidebarLayout = data.sidebarWidgetLayout;
        untrack(() => {
            widgetsData = widgets;
            indexWidgetsStore.initFromServer(widgets);
            widgetLayoutStore.initFromServer(layout, sidebarLayout);
        });
    });

    // SEO 설정 (홈페이지)
    const siteName = import.meta.env.VITE_SITE_NAME || 'Angple';

    const seoConfig: SeoConfig = $derived({
        meta: {
            title: siteName,
            description: `${siteName} 커뮤니티 - 자유로운 소통의 공간`,
            canonicalUrl: $page.url.origin
        },
        og: {
            title: siteName,
            description: `${siteName} 커뮤니티 - 자유로운 소통의 공간`,
            type: 'website',
            url: $page.url.origin
        },
        jsonLd: [createWebSiteJsonLd(`${$page.url.origin}/search?stx={search_term_string}`)]
    });

    onMount(async () => {
        // SSR 데이터 없을 경우 클라이언트에서 fetch
        if (!widgetsData) {
            const fetchedData = await apiClient.getIndexWidgets();
            widgetsData = fetchedData;
            indexWidgetsStore.initFromServer(fetchedData);
        }
    });
</script>

<SeoHead config={seoConfig} />

<!-- 통합 위젯 렌더러로 메인 영역 렌더링 -->
<WidgetRenderer zone="main" />

<!-- 편집 모드 토글 버튼 -->
<EditModeToggle />
