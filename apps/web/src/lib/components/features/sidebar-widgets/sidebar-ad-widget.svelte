<script lang="ts">
    /**
     * 사이드바 광고 위젯
     * type: 'damoang' (DamoangBanner, 기본값), 'image' (ImageBanner), 'image-text' (ImageTextBanner), 'gam' (AdSlot - GAM 광고)
     */
    import DamoangBanner from '$lib/components/ui/damoang-banner/damoang-banner.svelte';
    import ImageBanner from '$lib/components/ui/image-banner/image-banner.svelte';
    import ImageTextBanner from '$lib/components/ui/image-text-banner/image-text-banner.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';

    interface Props {
        isEditMode?: boolean;
        settings?: {
            type?: 'damoang' | 'image' | 'image-text' | 'gam';
            format?: 'square' | 'grid';
            position?: string;
        };
    }

    let { isEditMode = false, settings = {} }: Props = $props();

    const adType = $derived(settings.type ?? 'damoang');
    const adPosition = $derived(settings.position ?? 'sidebar');

    // AdSense 설정
    const ADSENSE_SLOTS = {
        square: '7466402991'
    };
</script>

<div class:ring-2={isEditMode} class:ring-blue-500={isEditMode} class:rounded-lg={isEditMode}>
    <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-medium text-slate-500">AD</span>
    </div>
    {#if adType === 'gam'}
        <AdSlot position={adPosition} height="250px" />
    {:else if adType === 'damoang'}
        <DamoangBanner position="sidebar" height="250px" showCelebration={false} />
    {:else if adType === 'image'}
        <ImageBanner
            position="sidebar"
            width="100%"
            height="250px"
            fallbackToAdsense={true}
            adsenseSlot={ADSENSE_SLOTS.square}
            adsenseFormat="rectangle"
        />
    {:else}
        <ImageTextBanner position="side-image-text-banner" />
    {/if}
</div>
