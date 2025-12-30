<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import type { Component } from 'svelte';
    import Header from '$lib/components/layout/header.svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import Panel from '$lib/components/layout/panel.svelte';
    import Footer from '$lib/components/layout/footer.svelte';
    import LeftBanner from '$lib/components/layout/left-banner.svelte';
    import RightBanner from '$lib/components/layout/right-banner.svelte';
    import PodcastPlayer from '$lib/components/ui/podcast-player/podcast-player.svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import { themeStore } from '$lib/stores/theme.svelte';
    import { loadThemeHooks } from '$lib/hooks/theme-loader';
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import { loadThemeComponents } from '$lib/utils/theme-component-loader';

    const { children } = $props(); // Svelte 5
    let snbPosition = $state<'left' | 'right'>('left'); // 기본값

    let isBannerUp = $state(false);
    let lastScrollY = $state(0);

    // 현재 활성 테마
    const activeTheme = $derived(themeStore.currentTheme.activeTheme);

    // 동적으로 로드된 테마 레이아웃 컴포넌트
    let ThemeLayout = $state<Component | null>(null);

    // Vite의 import.meta.glob으로 모든 테마 레이아웃 패턴 정의
    const themeLayouts = import.meta.glob('/themes/*/layouts/main-layout.svelte');

    /**
     * 테마 레이아웃 동적 로드
     */
    async function loadThemeLayout(themeId: string | null) {
        if (!themeId) {
            ThemeLayout = null;
            return;
        }

        try {
            const layoutPath = `/themes/${themeId}/layouts/main-layout.svelte`;

            // glob 패턴에 매칭되는 경로가 있는지 확인
            if (layoutPath in themeLayouts) {
                const module = (await themeLayouts[layoutPath]()) as { default: Component };
                ThemeLayout = module.default;
                console.log(`✅ [Layout] 테마 레이아웃 로드: ${themeId}`);
            } else {
                // 테마 레이아웃이 없으면 기본 레이아웃 사용
                ThemeLayout = null;
                console.log(`ℹ️ [Layout] 테마 레이아웃 없음, 기본 레이아웃 사용: ${themeId}`);
            }
        } catch (error) {
            console.error(`❌ [Layout] 테마 레이아웃 로드 실패: ${themeId}`, error);
            ThemeLayout = null;
        }
    }

    function handleScroll() {
        const currentScrollY = window.scrollY;

        if (currentScrollY > lastScrollY && currentScrollY > 80) {
            isBannerUp = true; // 아래로 스크롤 시 배너 올림
        } else if (currentScrollY < lastScrollY) {
            isBannerUp = false; // 위로 스크롤 시 배너 내림
        }

        lastScrollY = currentScrollY;
    }

    // activeTheme 변경 시 자동으로 레이아웃, Hook, Component 로드
    $effect(() => {
        loadThemeLayout(activeTheme);

        // 테마 Hook 및 Component 로드
        if (activeTheme) {
            loadThemeHooks(activeTheme);
            loadThemeComponents(activeTheme);
        }
    });

    onMount(() => {
        // 테마 로드
        themeStore.loadActiveTheme();

        // 인증 상태 초기화
        authActions.initAuth();

        // 스크롤 이벤트
        window.addEventListener('scroll', handleScroll, { passive: true });

        // postMessage 리스너 (Admin에서 테마 변경 시 리로드)
        function handleMessage(event: MessageEvent) {
            // 보안: localhost에서만 허용
            if (!event.origin.includes('localhost')) return;

            if (event.data?.type === 'reload-theme') {
                console.log('🔄 테마 리로드 요청 받음');
                themeStore.loadActiveTheme();
            }
        }

        window.addEventListener('message', handleMessage);

        // visibilitychange 리스너 (탭 전환 시 테마 변경 자동 감지)
        let lastThemeCheckTimestamp = 0;

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                try {
                    // Cookie에서 테마 변경 플래그 읽기
                    const cookies = document.cookie.split(';');
                    const triggerCookie = cookies.find((c) =>
                        c.trim().startsWith('theme-reload-trigger=')
                    );

                    if (triggerCookie) {
                        const value = triggerCookie.split('=')[1]; // "themeId:timestamp"
                        const [themeId, timestampStr] = value.split(':');
                        const timestamp = parseInt(timestampStr, 10);

                        // 마지막 확인 이후 변경된 경우에만 리로드
                        if (timestamp > lastThemeCheckTimestamp) {
                            console.log('🔄 테마 변경 감지 (탭 전환):', themeId, '리로드 중...');
                            themeStore.loadActiveTheme();
                            lastThemeCheckTimestamp = timestamp;
                        }
                    }
                } catch (e) {
                    console.warn('테마 변경 감지 실패:', e);
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    });
</script>

<svelte:head>
    <title>다모앙</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
    <!-- Damoang Ads Script -->
    <script async src="https://ads.damoang.net/ad.js"></script>
</svelte:head>

<!-- 테마별 완전한 레이아웃 전환 -->
{#if ThemeLayout}
    <!-- 동적으로 로드된 테마 레이아웃 (Svelte 5: 컴포넌트 변수 직접 사용) -->
    <ThemeLayout>
        {@render children()}
    </ThemeLayout>
{:else}
    <!-- 기본 레이아웃 -->
    <div class="relative flex min-h-screen flex-col items-center">
        <!-- 배경 박스 -->
        {#if snbPosition === 'left'}
            <div class="snb-backdrop-left"></div>
        {:else if snbPosition === 'right'}
            <div class="snb-backdrop-right"></div>
        {/if}

        <div class="container relative z-10 flex w-full flex-1 flex-col">
            <!-- Slot: header-before -->
            {#each getComponentsForSlot('header-before') as slotComp (slotComp.id)}
                {@const Component = slotComp.component}
                <Component {...slotComp.props || {}} />
            {/each}

            <Header />

            <!-- Slot: header-after -->
            {#each getComponentsForSlot('header-after') as slotComp (slotComp.id)}
                {@const Component = slotComp.component}
                <Component {...slotComp.props || {}} />
            {/each}

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

                <main class="box-content flex-1 overflow-y-auto pt-1 md:py-5 lg:pe-6 2xl:!px-9">
                    <!-- Slot: content-before -->
                    {#each getComponentsForSlot('content-before') as slotComp (slotComp.id)}
                        {@const Component = slotComp.component}
                        <Component {...slotComp.props || {}} />
                    {/each}

                    {@render children()}

                    <!-- Slot: content-after -->
                    {#each getComponentsForSlot('content-after') as slotComp (slotComp.id)}
                        {@const Component = slotComp.component}
                        <Component {...slotComp.props || {}} />
                    {/each}
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
        <aside
            class="fixed hidden transition-all duration-300 min-[1600px]:block"
            class:top-21={!isBannerUp}
            class:top-6={isBannerUp}
            style="right: calc(50% + 760px);"
        >
            <LeftBanner />
        </aside>
        <!-- 오른쪽 윙 배너 - 컨테이너 바로 오른쪽 (10px 간격) -->
        <aside
            class="fixed hidden transition-all duration-300 min-[1600px]:block"
            class:top-21={!isBannerUp}
            class:top-6={isBannerUp}
            style="left: calc(50% + 760px);"
        >
            <RightBanner />
        </aside>

        <!-- Slot: footer-before -->
        {#each getComponentsForSlot('footer-before') as slotComp (slotComp.id)}
            {@const Component = slotComp.component}
            <Component {...slotComp.props || {}} />
        {/each}

        <!-- 푸터 -->
        <Footer />

        <!-- Slot: footer-after -->
        {#each getComponentsForSlot('footer-after') as slotComp (slotComp.id)}
            {@const Component = slotComp.component}
            <Component {...slotComp.props || {}} />
        {/each}

        <!-- 팟캐스트 플레이어 (항상 마운트, 위치만 변경) -->
        <PodcastPlayer />
    </div>
{/if}
