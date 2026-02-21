<script lang="ts">
    import '../../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import Header from '$lib/components/layout/header.svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import Panel from '$lib/components/layout/panel.svelte';
    import Footer from '$lib/components/layout/footer.svelte';
    import LeftBanner from '$lib/components/layout/left-banner.svelte';
    import RightBanner from '$lib/components/layout/right-banner.svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { DamoangBanner } from '$lib/components/ui/damoang-banner';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';

    /**
     * 기본 레이아웃 컴포넌트
     * 테마가 활성화되지 않았을 때 사용되는 fallback 레이아웃
     */

    const { children } = $props(); // Svelte 5
    let snbPosition = $state<'left' | 'right'>('left'); // 기본값

    onMount(() => {
        // 인증 상태 초기화
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>{import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
</svelte:head>

<div class="relative flex min-h-screen flex-col items-center">
    <!-- 배경 박스 -->
    {#if snbPosition === 'left'}
        <div class="snb-backdrop-left"></div>
    {:else if snbPosition === 'right'}
        <div class="snb-backdrop-right"></div>
    {/if}

    <div class="container relative z-10 flex w-full flex-1 flex-col">
        <Header />

        <!-- 헤더 아래 광고 (축하이미지 → 다모앙광고 → GAM 폴백) -->
        {#if widgetLayoutStore.hasEnabledAds}
            <div class="mx-auto w-full px-4 py-2 lg:px-0">
                <DamoangBanner position="index" height="90px" />
            </div>

            <div class="mx-auto w-full px-4 py-2 lg:px-0">
                <AdSlot position="index-head" height="90px" />
            </div>
        {/if}

        <div class="mx-auto flex w-full flex-1">
            {#if snbPosition === 'right'}
                <aside
                    class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:block"
                >
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
            {#if snbPosition === 'left'}
                <aside
                    class="bg-background sticky top-12 hidden h-[calc(100vh-3rem)] self-start md:top-16 md:h-[calc(100vh-4rem)] 2xl:block 2xl:!w-[230px]"
                >
                    <Sidebar />
                </aside>
            {/if}

            <main class="box-content min-w-0 flex-1 pt-1 md:py-5 lg:pe-6 2xl:!px-9">
                {@render children()}
            </main>
            {#if snbPosition === 'right'}
                <aside class="bg-background hidden 2xl:block 2xl:!w-[230px]">
                    <Sidebar />
                </aside>
            {/if}

            {#if snbPosition === 'left'}
                <aside
                    class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:block"
                >
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
        </div>
    </div>
    <!-- 왼쪽 윙 배너 - 컨테이너 바로 왼쪽 (160px 배너 + 10px 간격) -->
    <aside class="top-21 fixed hidden min-[1600px]:block" style="right: calc(50% + 696px);">
        <LeftBanner />
    </aside>
    <!-- 오른쪽 윙 배너 - 컨테이너 바로 오른쪽 (10px 간격) -->
    <aside class="top-21 fixed hidden min-[1600px]:block" style="left: calc(50% + 696px);">
        <RightBanner />
    </aside>

    <!-- 푸터 -->
    <Footer />
</div>
