<script lang="ts">
    import ImageBanner from '$lib/components/ui/image-banner/image-banner.svelte';

    // AdSense 설정 (ang-gnu 동일)
    const ADSENSE_VERTICAL_SLOT = '7464730194'; // DA_Vertical_Banner_01 (160×600)
</script>

<!-- 왼쪽 윙 배너 -->
<div class="flex w-[160px] flex-col items-center justify-center gap-2">
    <ImageBanner
        position="wing-left"
        width="160px"
        height="600px"
        fallbackToAdsense={true}
        adsenseSlot={ADSENSE_VERTICAL_SLOT}
        adsenseFormat="vertical"
    />
</div>
