<script lang="ts">
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import { getComponentsForSlot } from '$lib/components/slot-manager';

    /**
     * Corporate Landing Theme - Main Layout
     *
     * 하이브리드 레이아웃: 랜딩 페이지 + 커뮤니티
     * - 조건부 레이아웃 렌더링 (경로 기반)
     * - Particles 효과
     * - 모던한 디자인
     */

    const { children } = $props();

    onMount(() => {
        console.log('🎨 Corporate Landing Theme 레이아웃 마운트됨');
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>Corporate Landing - Powered by Angple</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Modern corporate landing page with community features" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-gradient-to-br from-white via-blue-50 to-white">
    <!-- Background Effects -->
    {#each getComponentsForSlot('background') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- Main Content -->
    <main class="relative flex-1">
        {@render children()}
    </main>
</div>
