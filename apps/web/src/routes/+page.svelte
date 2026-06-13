<script lang="ts">
    import { page } from '$app/state';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { untrack } from 'svelte';
    import { SeoHead, createWebSiteJsonLd, getSiteUrl } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import { getThemePageTemplate } from '$lib/themes/page-registry';

    let { data } = $props();

    // #1548: 테마가 'home' 페이지 템플릿을 제공하면 코어 위젯 대신 그 템플릿으로 홈을 렌더.
    // 미제공(대부분 테마) 시 null → 기존 WidgetRenderer 경로 유지 (회귀 0).
    const ThemeHome = $derived(getThemePageTemplate(page.data.site?.theme_id ?? null, 'home'));

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

    // SEO 설정 (홈페이지) — multi-tenant: host 로 resolve 된 site 의 title/description 우선.
    // VITE_SITE_NAME 은 빌드타임 상수라 공유 이미지에선 모든 사이트가 같은 값이 됨 → 런타임 우선.
    // site.title 이 있으면 완성형 제목으로 그대로 사용(태그라인 중복 append 방지),
    // 없으면 기존 damoang 기본 포맷 유지(회귀 0).
    const fallbackName = import.meta.env.VITE_SITE_NAME || '다모앙';
    const siteName = $derived(page.data.site?.title || fallbackName);
    const homeTitle = $derived(page.data.site?.title || `${fallbackName} | 종합 포털 커뮤니티`);
    const homeDescription = $derived(
        page.data.site?.description || `${siteName} - 자유로운 소통의 공간`
    );

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

<!-- 플러그인 슬롯: 홈 콘텐츠 직전 (위젯 영역 위) — Slot Catalog Sprint 2c -->
<PluginSlot name="home-content-before" />

{#if ThemeHome}
    <!-- #1548: 테마가 home 템플릿을 제공하면 그것으로 렌더 (사이트별 커스텀 홈) -->
    <ThemeHome {data} />
{:else}
    <!-- 통합 위젯 렌더러로 메인 영역 렌더링 (추천글 SSR 프리페치 포함) — 코어 기본 -->
    <WidgetRenderer
        zone="main"
        prefetchDataMap={{
            recommended: data.recommendedData
                ? { data: data.recommendedData, period: data.recommendedPeriod }
                : undefined,
            explore: data.exploreData ? { data: data.exploreData } : undefined,
            // 결합 위젯(공감글+모아보기 2단)이 실제 홈 레이아웃에 쓰이므로 이 키로도 SSR 데이터를
            // 매핑해야 함. 누락 시 empathy-explore-row 의 prefetchData 가 undefined → RecommendedPosts
            // 가 SSR 에서 스켈레톤(loading=true)으로 렌더되어 CDN 캐시 → 전 방문자가 스켈레톤+재fetch.
            'empathy-explore-row': {
                recommended: data.recommendedData
                    ? { data: data.recommendedData, period: data.recommendedPeriod }
                    : undefined,
                explore: data.exploreData ? { data: data.exploreData } : undefined
            },
            // 홈 공감글 터치 오인식(#11998) — SSR 데이터가 빈 배열일 때 undefined 를 넘기면
            // 클라이언트 $effect 가 재요청을 보내 마음메시지 Card 가 hydration 직후 삽입되며
            // 그 아래 위젯이 밀리는 레이아웃 shift 를 유발. 빈 배열이라도 항상 prefetchData 로
            // 넘겨서 클라이언트 재요청을 차단함.
            celebration: { data: data.celebrationRecent ?? data.celebration ?? [] }
        }}
    />
{/if}

<!-- 플러그인 슬롯: 홈 콘텐츠 직후 (위젯 영역 아래) — Slot Catalog Sprint 2c -->
<PluginSlot name="home-content-after" />
