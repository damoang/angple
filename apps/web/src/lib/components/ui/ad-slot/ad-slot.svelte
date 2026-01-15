<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        position: string;
        height?: string;
        class?: string;
        fallbackToAdsense?: boolean;
    }

    let {
        position,
        height = '90px',
        class: className = '',
        fallbackToAdsense = true
    }: Props = $props();

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let showAdsense = $state(false);
    let adsenseLoaded = $state(false);

    // AdSense 설정 (ang-gnu 동일)
    const ADSENSE_CLIENT = 'ca-pub-5124617752473025';

    // 위치별 AdSense 슬롯 매핑
    const ADSENSE_SLOTS: Record<string, string> = {
        'index-head': '7466402991',
        'index-top': '7466402991',
        'index-middle-1': '7466402991',
        'index-middle-2': '7466402991',
        'index-middle-3': '7466402991',
        'index-bottom': '7466402991',
        'board-head': '7466402991',
        'board-content': '7466402991',
        'board-content-bottom': '7466402991'
    };

    // 위치별 라벨 매핑
    const positionLabels: Record<string, string> = {
        'index-head': '상단 광고',
        'index-top': '추천글 하단 광고',
        'index-middle-1': '중간 광고 1',
        'index-middle-2': '중간 광고 2',
        'index-middle-3': '중간 광고 3',
        'index-bottom': '하단 광고',
        'side-banner': '사이드 배너',
        'board-head': '게시판 상단',
        'board-content': '본문 광고',
        'board-content-bottom': '본문 하단'
    };

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
                pushAd();
            };
            document.head.appendChild(script);
        } else {
            adsenseLoaded = true;
            pushAd();
        }
    }

    function pushAd() {
        setTimeout(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.warn('AdSense push error:', e);
            }
        }, 100);
    }

    function enableAdsenseFallback() {
        if (fallbackToAdsense && ADSENSE_SLOTS[position]) {
            showAdsense = true;
            loadAdsense();
        }
    }

    onMount(() => {
        // ad.js가 로드되어 있으면 렌더링 요청
        if (window.DamoangAds) {
            window.DamoangAds.render(position);

            // 광고 로드 이벤트 리스닝
            window.DamoangAds.on('render', (data: { position: string }) => {
                if (data.position === position) {
                    isLoaded = true;
                    hasAd = true;
                }
            });

            window.DamoangAds.on('empty', (data: { position: string }) => {
                if (data.position === position) {
                    isLoaded = true;
                    hasAd = false;
                    enableAdsenseFallback();
                }
            });

            // 타임아웃: 3초 후에도 응답이 없으면 AdSense로 폴백
            setTimeout(() => {
                if (!isLoaded) {
                    isLoaded = true;
                    enableAdsenseFallback();
                }
            }, 3000);
        } else {
            // DamoangAds가 없으면 바로 AdSense 폴백
            isLoaded = true;
            enableAdsenseFallback();
        }
    });
</script>

<div
    class="ad-slot-container relative overflow-hidden rounded-lg transition-all duration-300 {className}"
    class:ad-slot-placeholder={!hasAd && !showAdsense}
    class:ad-slot-loaded={hasAd || showAdsense}
    style:min-height={height}
>
    {#if hasAd}
        <!-- DamoangAds 광고 -->
        <ins class="damoang-ad block w-full" data-position={position}></ins>
    {:else if showAdsense && ADSENSE_SLOTS[position]}
        <!-- AdSense 폴백 -->
        <div class="adsense-container w-full overflow-hidden">
            {#if adsenseLoaded}
                <ins
                    class="adsbygoogle"
                    style="display:block; width:100%; min-height:{height};"
                    data-ad-client={ADSENSE_CLIENT}
                    data-ad-slot={ADSENSE_SLOTS[position]}
                    data-ad-format="horizontal"
                    data-full-width-responsive="true"
                ></ins>
            {:else}
                <div
                    class="flex animate-pulse items-center justify-center bg-slate-100 dark:bg-slate-800"
                    style="min-height: {height};"
                >
                    <span class="text-xs text-slate-400">Loading...</span>
                </div>
            {/if}
        </div>
    {:else}
        <!-- 광고가 없을 때 플레이스홀더 -->
        <div class="absolute inset-0 flex items-center justify-center">
            <div class="flex flex-col items-center gap-2 text-center">
                <svg
                    class="text-dusty-400 dark:text-dusty-500 h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                </svg>
                <span class="text-dusty-500 dark:text-dusty-400 text-xs font-medium">
                    {positionLabels[position] || position}
                </span>
            </div>
        </div>
    {/if}
</div>

<style>
    .ad-slot-placeholder {
        background: linear-gradient(135deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%);
        border: 2px dashed #cbd5e1;
    }

    :global(.dark) .ad-slot-placeholder {
        background: linear-gradient(135deg, #334155 0%, #475569 50%, #334155 100%);
        border-color: #475569;
    }

    .ad-slot-loaded {
        border: none;
        background: transparent;
    }

    .ad-slot-placeholder::before {
        content: '';
        position: absolute;
        inset: 0;
        animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.6;
        }
    }
</style>
