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

    const { children } = $props(); // Svelte 5
    let snbPosition = $state<'left' | 'right'>('left'); // 기본값

    let isBannerUp = $state(false);
    let lastScrollY = $state(0);

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
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    });
</script>

<svelte:head>
    <title>다모앙</title>
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
    <!-- 왼쪽 배너 - 절대 위치, 컨테이너 밖에 배치 -->
    <aside
        class="fixed left-4 hidden transition-all duration-300 min-[1780px]:block"
        class:top-21={!isBannerUp}
        class:top-6={isBannerUp}
    >
        <LeftBanner />
    </aside>
    <!-- 오른쪽 배너 - 절대 위치, 컨테이너 밖에 배치 -->
    <aside
        class="fixed right-4 hidden transition-all duration-300 min-[1780px]:block"
        class:top-21={!isBannerUp}
        class:top-6={isBannerUp}
    >
        <RightBanner />
    </aside>

    <!-- 푸터 -->
    <Footer />
</div>
