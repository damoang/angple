<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import {
        initGAM,
        defineSlot,
        defineResponsiveSlot,
        destroySlot,
        isGAMInitialized,
        getAdSenseClient
    } from '$lib/stores/gam.svelte';
    import { POSITION_SIZES, ADSENSE_SLOTS } from '$lib/types/advertising';

    interface Props {
        position: string;
        sizes?: number[][];
        responsive?: boolean;
        fallbackToAdsense?: boolean;
        class?: string;
        minHeight?: string;
    }

    let {
        position,
        sizes,
        responsive = true,
        fallbackToAdsense = true,
        class: className = '',
        minHeight = '90px'
    }: Props = $props();

    // 슬롯 ID 생성
    const slotId = `gam-${position}-${Math.random().toString(36).substring(2, 9)}`;

    // 상태
    let isLoading = $state(true);
    let isEmpty = $state(false);
    let showAdsense = $state(false);
    let adsenseLoaded = $state(false);
    let slotElement: HTMLDivElement | null = $state(null);

    // 실제 사용할 사이즈
    const adSizes = $derived(sizes || POSITION_SIZES[position] || [[728, 90]]);

    // 반응형 사이즈 매핑 생성
    function getResponsiveSizeMapping() {
        const mapping = [];

        // 기본 사이즈 매핑 (뷰포트에 따라)
        if (position.startsWith('index-') || position === 'board-head') {
            // 가로형 배너
            mapping.push({
                viewport: [970, 0],
                sizes: [
                    [970, 250],
                    [970, 90],
                    [728, 90]
                ]
            });
            mapping.push({ viewport: [728, 0], sizes: [[728, 90]] });
            mapping.push({ viewport: [0, 0], sizes: [[300, 250]] });
        } else if (position === 'sidebar' || position === 'halfpage') {
            // 사이드바 배너
            mapping.push({ viewport: [1024, 0], sizes: adSizes });
            mapping.push({ viewport: [0, 0], sizes: [] }); // 모바일에서는 숨김
        } else if (position.startsWith('wing-')) {
            // 윙 배너
            mapping.push({ viewport: [1600, 0], sizes: [[160, 600]] });
            mapping.push({ viewport: [0, 0], sizes: [] });
        } else {
            // 기본
            mapping.push({ viewport: [0, 0], sizes: adSizes });
        }

        return mapping;
    }

    // 슬롯 렌더 완료 핸들러
    function handleRenderEnd(isEmptySlot: boolean) {
        isLoading = false;
        isEmpty = isEmptySlot;

        if (isEmptySlot && fallbackToAdsense) {
            enableAdsenseFallback();
        }
    }

    // AdSense 폴백 활성화
    function enableAdsenseFallback() {
        const slot = ADSENSE_SLOTS[position];
        if (!slot) return;

        showAdsense = true;
        loadAdsense();
    }

    // AdSense 스크립트 로드
    function loadAdsense() {
        if (!browser) return;

        const client = getAdSenseClient();
        const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');

        if (!existingScript) {
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                adsenseLoaded = true;
                pushAdsense();
            };
            document.head.appendChild(script);
        } else {
            adsenseLoaded = true;
            pushAdsense();
        }
    }

    // AdSense 광고 푸시
    function pushAdsense() {
        setTimeout(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.warn('[GAM] AdSense push error:', e);
            }
        }, 100);
    }

    onMount(async () => {
        if (!browser) return;

        // GAM 초기화
        const initialized = await initGAM();

        if (!initialized) {
            // GAM 초기화 실패 시 AdSense 폴백
            isLoading = false;
            isEmpty = true;
            if (fallbackToAdsense) {
                enableAdsenseFallback();
            }
            return;
        }

        // 슬롯 정의
        if (responsive) {
            defineResponsiveSlot(position, slotId, getResponsiveSizeMapping(), handleRenderEnd);
        } else {
            defineSlot(position, slotId, adSizes, handleRenderEnd);
        }

        // 타임아웃: 5초 후에도 로딩 중이면 폴백
        setTimeout(() => {
            if (isLoading) {
                isLoading = false;
                isEmpty = true;
                if (fallbackToAdsense) {
                    enableAdsenseFallback();
                }
            }
        }, 5000);
    });

    onDestroy(() => {
        if (browser) {
            destroySlot(slotId);
        }
    });
</script>

<div
    class="gam-slot-container relative overflow-hidden {className}"
    class:gam-slot-loading={isLoading}
    class:gam-slot-empty={isEmpty && !showAdsense}
    style:min-height={minHeight}
    bind:this={slotElement}
>
    {#if !showAdsense}
        <!-- GAM 슬롯 -->
        <div id={slotId} class="gam-slot w-full"></div>
    {/if}

    {#if showAdsense && ADSENSE_SLOTS[position]}
        <!-- AdSense 폴백 -->
        <div class="adsense-container w-full overflow-hidden">
            {#if adsenseLoaded}
                <ins
                    class="adsbygoogle"
                    style="display:block; width:100%; min-height:{minHeight};"
                    data-ad-client={getAdSenseClient()}
                    data-ad-slot={ADSENSE_SLOTS[position]}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                ></ins>
            {:else}
                <div
                    class="flex animate-pulse items-center justify-center bg-slate-100 dark:bg-slate-800"
                    style="min-height: {minHeight};"
                >
                    <span class="text-xs text-slate-400">Loading...</span>
                </div>
            {/if}
        </div>
    {/if}

    {#if isLoading}
        <!-- 로딩 플레이스홀더 -->
        <div
            class="absolute inset-0 flex animate-pulse items-center justify-center bg-slate-50 dark:bg-slate-800/50"
        >
            <div class="flex flex-col items-center gap-2">
                <div
                    class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
                ></div>
                <span class="text-xs text-slate-400">AD</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .gam-slot-loading {
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%);
    }

    :global(.dark) .gam-slot-loading {
        background: linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%);
    }

    .gam-slot-empty {
        border: 2px dashed #e2e8f0;
    }

    :global(.dark) .gam-slot-empty {
        border-color: #475569;
    }

    .gam-slot {
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
