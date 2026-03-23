<script lang="ts">
    import { page } from '$app/state';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { untrack } from 'svelte';
    import { SeoHead, createWebSiteJsonLd, getSiteUrl } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';

    let { data } = $props();

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

    const leftMessageVisible = $derived(page.url.searchParams.get('left') === '1');
</script>

<SeoHead config={seoConfig} />

{#if leftMessageVisible}
    <div class="mx-auto mb-4 max-w-5xl px-4 pt-4">
        <div
            class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
            회원 탈퇴가 완료되었습니다. 안전하게 로그아웃되었습니다.
        </div>
    </div>
{/if}

<!-- 통합 위젯 렌더러로 메인 영역 렌더링 (추천글 SSR 프리페치 포함) -->
<WidgetRenderer
    zone="main"
    prefetchDataMap={{
        recommended: data.recommendedData
            ? { data: data.recommendedData, period: data.recommendedPeriod }
            : undefined,
        explore: data.exploreData ? { data: data.exploreData } : undefined,
        'empathy-explore-row': {
            recommended: data.recommendedData
                ? { data: data.recommendedData, period: data.recommendedPeriod }
                : undefined,
            explore: data.exploreData ? { data: data.exploreData } : undefined
        },
        celebration: (data.celebrationRecent ?? data.celebration)?.length
            ? { data: data.celebrationRecent ?? data.celebration }
            : undefined
    }}
/>
