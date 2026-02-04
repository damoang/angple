<script lang="ts">
    /**
     * 사이드바 광고 위젯
     * type: 'image' (ImageBanner) 또는 'image-text' (ImageTextBanner)
     */
    import ImageBanner from '$lib/components/ui/image-banner/image-banner.svelte';
    import ImageTextBanner from '$lib/components/ui/image-text-banner/image-text-banner.svelte';

    interface Props {
        isEditMode?: boolean;
        settings?: {
            type?: 'image' | 'image-text';
            format?: 'square' | 'grid';
        };
    }

    let { isEditMode = false, settings = {} }: Props = $props();

    const adType = $derived(settings.type ?? 'image');

    // AdSense 설정
    const ADSENSE_SLOTS = {
        square: '7466402991'
    };
</script>

<div class:ring-2={isEditMode} class:ring-blue-500={isEditMode} class:rounded-lg={isEditMode}>
    <div class="mb-2 flex items-center justify-between">
        <span class="text-xs font-medium text-slate-500">AD</span>
    </div>
    {#if adType === 'image'}
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
