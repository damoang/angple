<script lang="ts">
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import { EditModeToggle } from '$lib/components/features/widget-editor';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { untrack } from 'svelte';
    import { SeoHead, createWebSiteJsonLd, getSiteUrl } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';

    const { data } = $props();

    // SSR 데이터 즉시 스토어 초기화 (hydration 전에 실행)
    indexWidgetsStore.initFromServer(data.indexWidgets);
    widgetLayoutStore.initFromServer(data.widgetLayout, data.sidebarWidgetLayout);

    // SSR 데이터 변경 시 스토어 동기화 (SPA 내비게이션 대응)
    $effect(() => {
        const widgets = data.indexWidgets;
        const layout = data.widgetLayout;
        const sidebarLayout = data.sidebarWidgetLayout;
        untrack(() => {
            indexWidgetsStore.initFromServer(widgets);
            widgetLayoutStore.initFromServer(layout, sidebarLayout);
        });
    });

    // SEO 설정 (홈페이지)
    const siteName = import.meta.env.VITE_SITE_NAME || '다모앙';
    const siteTagline = '종합 포털 커뮤니티';
    const homeTitle = `${siteName} | ${siteTagline}`;
    const homeDescription = `${siteName} ${siteTagline} - 자유로운 소통의 공간 | Damoang Community Portal`;

    const seoConfig: SeoConfig = $derived({
        meta: {
            title: homeTitle,
            description: homeDescription,
            canonicalUrl: getSiteUrl(),
            includeSiteName: false
        },
        og: {
            title: homeTitle,
            description: homeDescription,
            type: 'website',
            url: getSiteUrl()
        },
        jsonLd: [createWebSiteJsonLd(`${getSiteUrl()}/search?stx={search_term_string}`)]
    });
</script>

<SeoHead config={seoConfig} />

<!-- 통합 위젯 렌더러로 메인 영역 렌더링 -->
<WidgetRenderer zone="main" />

<!-- 편집 모드 토글 버튼 (서버 검증된 관리자만 표시) -->
<EditModeToggle serverIsAdmin={data.isAdmin ?? false} />
