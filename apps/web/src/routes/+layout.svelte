<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import Header from '$lib/components/layout/header.svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import Panel from '$lib/components/layout/panel.svelte';
    import Footer from '$lib/components/layout/footer.svelte';
    import LeftBanner from '$lib/components/layout/left-banner.svelte';
    import RightBanner from '$lib/components/layout/right-banner.svelte';
    import PodcastPlayer from '$lib/components/ui/podcast-player/podcast-player.svelte';
    import SampleThemeLayout from '$lib/themes/sample-theme/layouts/main-layout.svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import { themeStore } from '$lib/stores/theme.svelte';

    const { children } = $props(); // Svelte 5
    let snbPosition = $state<'left' | 'right'>('left'); // 기본값

    let isBannerUp = $state(false);
    let lastScrollY = $state(0);

    // 현재 활성 테마
    const activeTheme = $derived(themeStore.currentTheme.activeTheme);

    function handleScroll() {
        const currentScrollY = window.scrollY;

        if (currentScrollY > lastScrollY && currentScrollY > 80) {
            isBannerUp = true; // 아래로 스크롤 시 배너 올림
        } else if (currentScrollY < lastScrollY) {
            isBannerUp = false; // 위로 스크롤 시 배너 내림
        }

        lastScrollY = currentScrollY;
    }

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

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('message', handleMessage);
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
{#if activeTheme === 'sample-theme'}
    <SampleThemeLayout>
        {@render children()}
    </SampleThemeLayout>
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
            <Header />

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

    <!-- 푸터 -->
    <Footer />

    <!-- 팟캐스트 플레이어 (항상 마운트, 위치만 변경) -->
    <PodcastPlayer />
    </div>
{/if}
