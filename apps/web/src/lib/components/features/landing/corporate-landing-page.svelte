<script lang="ts">
    import { getComponentsForSlot } from '$lib/components/slot-manager';

    // 슬롯에서 컴포넌트 가져오기
    const backgroundComponents = getComponentsForSlot('background');
    const heroComponents = getComponentsForSlot('landing-hero');
    const contentComponents = getComponentsForSlot('landing-content');

    console.log('🎯 [Corporate Landing] Background 컴포넌트:', backgroundComponents.length);
    console.log('🎯 [Corporate Landing] Hero 컴포넌트:', heroComponents.length);
    console.log('🎯 [Corporate Landing] Content 컴포넌트:', contentComponents.length);
</script>

<!-- Hero Section -->
<section class="relative min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
    <!-- Particles Background Slot -->
    {#each backgroundComponents as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <!-- Hero Content Slot -->
    {#each heroComponents as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}
</section>

<!-- Landing Content Sections (Services, Projects, Contact) -->
{#each contentComponents as slotComp (slotComp.id)}
    {@const Component = slotComp.component}
    <Component {...slotComp.props || {}} />
{/each}
