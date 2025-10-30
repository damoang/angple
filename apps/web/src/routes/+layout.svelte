<script lang="ts">
    import '../app.css';
    import Header from '$lib/components/layout/header.svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import Panel from '$lib/components/layout/panel.svelte';
    import Footer from '$lib/components/layout/footer.svelte';
    import LeftBanner from '$lib/components/layout/left-banner.svelte';
    import RightBanner from '$lib/components/layout/right-banner.svelte';

    const { children } = $props(); // Svelte 5
    let snbPosition: 'left' | 'right' = 'left'; // 기본값
</script>

<svelte:head>
    <title>Quilt UI Kit</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
                <aside class="bg-subtle border-border my-5 hidden max-w-[320px] rounded-md border lg:block lg:flex-1">
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
            {#if snbPosition === 'left'}
                <aside class="bg-background hidden w-[14.5rem] 2xl:block">
                    <Sidebar />
                </aside>
            {/if}

            <main class="flex-1 overflow-y-auto rounded-t-xl pt-1 md:py-5 lg:pe-6 xl:min-w-[824px] 2xl:px-6">
                {@render children()}
            </main>
            {#if snbPosition === 'right'}
                <aside class="bg-background hidden w-[14.5rem] 2xl:block">
                    <Sidebar />
                </aside>
            {/if}

            {#if snbPosition === 'left'}
                <aside class="bg-subtle border-border my-5 hidden max-w-[20rem] rounded-md border lg:block lg:flex-1">
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
        </div>
    </div>
    <!-- 왼쪽 배너 - 절대 위치, 1200px 밖에 배치 -->
    <aside class="top-21 fixed left-4 hidden min-[1764px]:block">
        <LeftBanner />
    </aside>
    <!-- 오른쪽 배너 - 절대 위치, 1200px 밖에 배치 -->
    <aside class="top-21 fixed right-4 hidden min-[1764px]:block">
        <RightBanner />
    </aside>

    <!-- 푸터 -->
    <Footer />
</div>
