<script lang="ts">
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import ClassicHeader from '../components/classic-header.svelte';
    import ClassicFooter from '../components/classic-footer.svelte';
    import ClassicSidebar from '../components/classic-sidebar.svelte';

    /**
     * Damoang Classic Theme - 전통적인 커뮤니티 레이아웃
     * - 2단 레이아웃
     * - 사이드바 위치 설정 가능 (left/right)
     * - 그린 + 블루 색상
     */

    const { children } = $props();

    // 테마 설정 (추후 동적으로 로드)
    const sidebarPosition = 'left';

    onMount(() => {
        console.log('🎨 Damoang Classic Theme 레이아웃 마운트됨');
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>다모앙 - Damoang Classic</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
    <meta name="description" content="전통적인 커뮤니티 레이아웃" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-gray-50">
    <!-- Header -->
    <ClassicHeader />

    <!-- Breadcrumb -->
    <div class="border-b border-gray-200 bg-white">
        <div class="container mx-auto px-4 py-2">
            <nav class="text-sm text-gray-600">
                <span>홈</span> > <span class="text-emerald-600">자유게시판</span>
            </nav>
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="container mx-auto flex flex-1 gap-6 px-4 py-6">
        {#if sidebarPosition === 'left'}
            <!-- Left Sidebar -->
            <aside class="hidden w-64 flex-shrink-0 lg:block">
                <ClassicSidebar />
            </aside>
        {/if}

        <!-- Page Content -->
        <main class="min-w-0 flex-1 rounded-lg bg-white p-6 shadow-sm">
            {@render children()}
        </main>

        {#if sidebarPosition === 'right'}
            <!-- Right Sidebar -->
            <aside class="hidden w-64 flex-shrink-0 lg:block">
                <ClassicSidebar />
            </aside>
        {/if}
    </div>

    <!-- Footer -->
    <ClassicFooter />
</div>
