<script lang="ts">
    /**
     * Sticky 광고 위젯 (PC 전용)
     */
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import type { WidgetProps } from '$lib/types/widget-props';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    const ADSENSE_CLIENT = 'ca-pub-5124617752473025';
    const ADSENSE_SLOTS = {
        square: '7466402991',
        halfpage: '7464730194'
    };

    let adsenseLoaded = $state(false);

    onMount(() => {
        loadAdsense();
    });

    function loadAdsense() {
        if (!browser) return;

        const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                adsenseLoaded = true;
                pushAds();
            };
            document.head.appendChild(script);
        } else {
            adsenseLoaded = true;
            pushAds();
        }
    }

    function pushAds() {
        setTimeout(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.warn('AdSense error:', e);
            }
        }, 100);
    }
</script>

<div
    class="hidden flex-col gap-4 lg:sticky lg:flex"
    style="top: 120px; margin-bottom: 20px; max-width: 288px;"
>
    <!-- Square 배너 (280x280) -->
    <div>
        <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">Sponsored</span>
        </div>
        <div class="overflow-hidden rounded-xl border border-border bg-background">
            {#if adsenseLoaded}
                <ins
                    class="adsbygoogle"
                    style="display:block;width:280px;height:280px"
                    data-ad-client={ADSENSE_CLIENT}
                    data-ad-slot={ADSENSE_SLOTS.square}
                    data-ad-format="auto"
                ></ins>
            {:else}
                <div
                    class="flex h-[280px] w-[280px] animate-pulse items-center justify-center bg-muted"
                >
                    <span class="text-xs text-muted-foreground">Loading...</span>
                </div>
            {/if}
        </div>
    </div>

    <!-- Halfpage 배너 (280x600 Sticky) -->
    <div>
        <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">Sponsored</span>
        </div>
        <div class="overflow-hidden rounded-xl border border-border bg-background">
            {#if adsenseLoaded}
                <ins
                    class="adsbygoogle"
                    style="display:block;width:280px;height:600px"
                    data-ad-client={ADSENSE_CLIENT}
                    data-ad-slot={ADSENSE_SLOTS.halfpage}
                    data-ad-format="auto"
                ></ins>
            {:else}
                <div
                    class="flex h-[600px] w-[280px] animate-pulse items-center justify-center bg-muted"
                >
                    <span class="text-xs text-muted-foreground">Loading...</span>
                </div>
            {/if}
        </div>
    </div>
</div>
