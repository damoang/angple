<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { authActions } from '$lib/stores/auth.svelte';
    import { getComponentsForSlot, subscribeToSlotChanges } from '$lib/components/slot-manager';
    import Header from '$lib/components/layout/header.svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import Footer from '$lib/components/layout/footer.svelte';

    /**
     * Corporate Landing Theme - Main Layout
     *
     * 하이브리드 레이아웃: 랜딩 페이지 + 커뮤니티
     * - 조건부 레이아웃 렌더링 (경로 기반)
     * - Particles 효과
     * - 모던한 디자인
     */

    const { children } = $props();

    // 현재 경로가 홈(/)인지 확인
    const isHomePage = $derived($page.url.pathname === '/');

    // 슬롯 변경 감지를 위한 $state
    let slotVersion = $state(0);

    // 슬롯에서 컴포넌트 가져오기 (slotVersion이 변경되면 다시 계산됨)
    const backgroundComponents = $derived.by(() => {
        slotVersion; // 의존성 추적
        return getComponentsForSlot('background');
    });
    const heroComponents = $derived.by(() => {
        slotVersion; // 의존성 추적
        return getComponentsForSlot('landing-hero');
    });
    const contentComponents = $derived.by(() => {
        slotVersion; // 의존성 추적
        return getComponentsForSlot('landing-content');
    });

    onMount(() => {
        console.log('🎨 Corporate Landing Theme 레이아웃 마운트됨');
        console.log('🏠 홈페이지:', isHomePage);
        authActions.initAuth();

        // 슬롯 변경 구독
        const unsubscribe = subscribeToSlotChanges(() => {
            console.log('🔔 [Slot Manager] 슬롯 변경 감지! 리렌더링 트리거');
            slotVersion++;
        });

        // cleanup
        return () => {
            unsubscribe();
        };
    });

    // 컴포넌트 개수 변경 감지 (디버깅용)
    $effect(() => {
        console.log('🔄 [Reactive] Background:', backgroundComponents.length);
        console.log('🔄 [Reactive] Hero:', heroComponents.length);
        console.log('🔄 [Reactive] Content:', contentComponents.length);
    });
</script>

<svelte:head>
    <title>Corporate Landing - Powered by Angple</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Modern corporate landing page with community features" />
</svelte:head>

{#if isHomePage}
    <!-- 홈페이지: 랜딩 페이지 레이아웃 (children 렌더링 안 함!) -->
    <div class="flex min-h-screen flex-col">
        <!-- Hero Section -->
        <section class="relative min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
            <!-- Particles Background -->
            {#each backgroundComponents as slotComp (slotComp.id)}
                {@const Component = slotComp.component}
                <Component {...slotComp.props || {}} />
            {/each}

            <!-- Hero Content -->
            {#each heroComponents as slotComp (slotComp.id)}
                {@const Component = slotComp.component}
                <Component {...slotComp.props || {}} />
            {/each}
        </section>

        <!-- Landing Content Sections -->
        {#each contentComponents as slotComp (slotComp.id)}
            {@const Component = slotComp.component}
            <Component {...slotComp.props || {}} />
        {/each}
    </div>
{:else}
    <!-- 커뮤니티 페이지: 기본 레이아웃 -->
    <div
        class="relative flex min-h-screen flex-col items-center bg-gradient-to-br from-white via-blue-50 to-white"
    >
        <div class="container relative z-10 flex w-full flex-1 flex-col">
            <Header />

            <div class="mx-auto flex w-full flex-1">
                <Sidebar />

                <main class="min-w-0 flex-1">
                    {@render children()}
                </main>
            </div>

            <Footer />
        </div>
    </div>
{/if}
