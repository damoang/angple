<script lang="ts">
    import { onMount } from 'svelte';
    import { getComponentsForSlot } from '$lib/components/slot-manager';

    /**
     * Landing Page Layout
     *
     * 순수 랜딩 페이지 레이아웃
     * - Hero Section
     * - Services/Projects/Contact 섹션
     * - Particles 효과
     */

    const { children } = $props();

    onMount(() => {
        console.log('🚀 Landing Layout 마운트됨');
    });
</script>

<div class="relative min-h-screen">
    <!-- Background Particles -->
    {#each getComponentsForSlot('background') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- Hero Section -->
    <div class="landing-hero">
        {#each getComponentsForSlot('landing-hero') as slotComp (slotComp.id)}
            {@const Component = slotComp.component}
            <Component {...slotComp.props || {}} />
        {/each}
    </div>

    <!-- Content Sections -->
    <div class="landing-content">
        {#each getComponentsForSlot('landing-content') as slotComp (slotComp.id)}
            {@const Component = slotComp.component}
            <Component {...slotComp.props || {}} />
        {/each}
    </div>

    <!-- Page Content -->
    {@render children()}
</div>
