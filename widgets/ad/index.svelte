<script lang="ts">
    /**
     * 통합 광고 슬롯 위젯
     *
     * 메인 영역과 사이드바 모두 지원합니다.
     * slot과 settings에 따라 적절한 광고 형태를 렌더링합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { AdSlot } from '$lib/components/ui/ad-slot';
    import ImageBanner from '$lib/components/ui/image-banner/image-banner.svelte';
    import ImageTextBanner from '$lib/components/ui/image-text-banner/image-text-banner.svelte';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    const position = $derived((config.settings?.position as string) ?? 'index-custom');
    const height = $derived((config.settings?.height as string) ?? '90px');
    const adType = $derived((config.settings?.type as string) ?? 'image');

    const isSidebar = $derived(slot === 'sidebar');

    const ADSENSE_SLOTS = {
        square: '7466402991'
    };
</script>

{#if isSidebar}
    <!-- 사이드바 광고 -->
    <div>
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
        {:else if adType === 'image-text'}
            <ImageTextBanner position="side-image-text-banner" />
        {:else}
            <AdSlot {position} height="250px" />
        {/if}
    </div>
{:else}
    <!-- 메인 영역 광고 -->
    <AdSlot {position} {height} />
{/if}
