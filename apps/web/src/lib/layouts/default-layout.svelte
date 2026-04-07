<script lang="ts">
    import '../../app.css';
    import { onMount } from 'svelte';
    import Header from '$lib/components/layout/header.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import Panel from '$lib/components/layout/panel.svelte';
    import Footer from '$lib/components/layout/footer.svelte';
    import LeftBanner from '$lib/components/layout/left-banner.svelte';
    import RightBanner from '$lib/components/layout/right-banner.svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import { page } from '$app/stores';
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

<div class="relative flex min-h-screen flex-col items-center">
    <!-- 배경 박스 -->
    {#if snbPosition === 'left'}
        <div class="snb-backdrop-left"></div>
    {:else if snbPosition === 'right'}
        <div class="snb-backdrop-right"></div>
    {/if}

    <div class="container relative z-10 flex w-full flex-1 flex-col">
        <Header />

        <div class="mx-auto flex w-full flex-1">
            {#if snbPosition === 'right'}
                <aside
                    class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:flex lg:flex-col"
                >
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
            {#if snbPosition === 'left'}
                <aside class="bg-background hidden 2xl:block 2xl:!w-[230px]">
                    <Sidebar />
                </aside>
            {/if}

            <div class="flex min-w-0 flex-1 flex-col">
                {#if widgetLayoutStore.hasEnabledAds && $page.url.pathname !== '/'}
                    <div class="hidden w-full px-5 pt-4 md:px-0 lg:block">
                        <AdSlot position="header-after" height="90px" slotKey="header-after" />
                    </div>
                {/if}
                <main
                    class="box-content min-w-0 flex-1 px-5 pt-1 md:px-0 md:py-5 lg:pe-1 2xl:!px-2 [&_[data-slot='card']]:-mx-5 md:[&_[data-slot='card']]:mx-0"
                >
                    {@render children()}
                </main>
            </div>
            {#if snbPosition === 'right'}
                <aside class="bg-background hidden 2xl:block 2xl:!w-[230px]">
                    <Sidebar />
                </aside>
            {/if}

            {#if snbPosition === 'left'}
                <aside
                    class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:flex lg:flex-col"
                >
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
        </div>
    </div>
    <!-- 왼쪽 윙 배너 - 1600px 이상에서 다시 노출 -->
    <aside class="top-21 fixed hidden min-[1600px]:block" style="right: calc(50% + 640px);">
        <LeftBanner />
    </aside>
    <!-- 오른쪽 윙 배너 - 1600px 이상에서 다시 노출 -->
    <aside class="top-21 fixed hidden min-[1600px]:block" style="left: calc(50% + 640px);">
        <RightBanner />
    </aside>

    <!-- 푸터 -->
    <Footer />
</div>
