<script lang="ts">
    import { onMount } from 'svelte';
    import { getComponentsForSlot } from '$lib/components/slot-manager';

    /**
     * Community Layout
     *
     * 커뮤니티 게시판 레이아웃
     * - 헤더/사이드바/푸터
     * - 게시판 중심 구조
     */

    const { children } = $props();

    onMount(() => {
        console.log('💬 Community Layout 마운트됨');
    });
</script>

<div class="flex min-h-screen flex-col bg-gray-50">
    <!-- Header -->
    <header class="border-b bg-white">
        <div class="container mx-auto flex h-16 items-center justify-between px-4">
            <h1 class="text-xl font-bold">Community</h1>
            <nav class="flex gap-4">
                <a href="/" class="hover:text-blue-600">홈</a>
                <a href="/community" class="hover:text-blue-600">게시판</a>
            </nav>
        </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto flex-1 px-4 py-6">
        {#each getComponentsForSlot('content-before') as slotComp (slotComp.id)}
            {@const Component = slotComp.component}
            <Component {...slotComp.props || {}} />
        {/each}

        {@render children()}

        {#each getComponentsForSlot('content-after') as slotComp (slotComp.id)}
            {@const Component = slotComp.component}
            <Component {...slotComp.props || {}} />
        {/each}
    </main>

    <!-- Footer -->
    <footer class="border-t bg-white py-6">
        <div class="container mx-auto px-4 text-center text-sm text-gray-600">
            Powered by Angple - Corporate Landing Theme
        </div>
    </footer>
</div>
