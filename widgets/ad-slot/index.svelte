<script lang="ts">
    /**
     * 통합 광고 슬롯 위젯
     *
     * 메인 영역과 사이드바 모두 지원합니다.
     * slot과 settings에 따라 적절한 광고 형태를 렌더링합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { AdSlot } from '$lib/components/ui/ad-slot';
    import ImageTextBanner from '$lib/components/ui/image-text-banner/image-text-banner.svelte';
    import { DamoangBanner } from '$lib/components/ui/damoang-banner';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    const position = $derived((config.settings?.position as string) ?? 'index-custom');
    const height = $derived((config.settings?.height as string) ?? '90px');
    const adType = $derived((config.settings?.type as string) ?? 'gam');
    const isSticky = $derived(config.settings?.sticky === true || position === 'sidebar-sticky');

    const isSidebar = $derived(slot === 'sidebar');
    const isHomeTopBanner = $derived(position === 'index-head' || position === 'index-top');
    const showCelebration = $derived(position === 'index-head');
</script>

{#if isSidebar}
    <!-- 사이드바 광고 -->
    <div class={isSticky ? 'sticky top-4' : ''}>
        <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">AD</span>
        </div>
        {#if adType === 'image-text'}
            <ImageTextBanner position="side-image-text-banner" />
        {:else}
            <AdSlot {position} height={isSticky ? '500px' : '250px'} />
        {/if}
    </div>
{:else if isHomeTopBanner}
    <!-- 홈 최상단: 자체 배너 우선, 없으면 같은 position으로 GAM 폴백 -->
    <DamoangBanner position="index" {height} {showCelebration} gamPosition={position} />
{:else}
    <!-- 메인 영역 광고 (GAM) -->
    <AdSlot {position} {height} />
{/if}
