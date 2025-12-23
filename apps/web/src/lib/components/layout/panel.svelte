<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import ImageBanner from '$lib/components/ui/image-banner/image-banner.svelte';
    import ImageTextBanner from '$lib/components/ui/image-text-banner/image-text-banner.svelte';

    // AdSense 설정 (ang-gnu 동일)
    const ADSENSE_CLIENT = 'ca-pub-5124617752473025';
    const ADSENSE_SLOTS = {
        square: '7466402991', // DA_Square_Banner_01 (280×280)
        halfpage: '7464730194' // DA_Vertical_Banner_01 (280×600)
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
                // 각 광고 슬롯에 대해 push
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.warn('AdSense error:', e);
            }
        }, 100);
    }
</script>

<div class="flex flex-col gap-4 p-4">
    <!-- 공지사항 -->
    <div
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
        <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <svg class="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
            공지사항
        </h3>
        <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <li class="truncate">• 서비스 점검 안내</li>
            <li class="truncate">• 새로운 기능 업데이트</li>
            <li class="truncate">• 커뮤니티 가이드라인</li>
        </ul>
    </div>

    <!-- 다모앙 팟캐스트 (PodcastPlayer가 여기로 이동됨) -->
    <div
        id="podcast-sidebar-anchor"
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
        <!-- PodcastPlayer 컴포넌트가 이 위치에 렌더링됨 -->
    </div>

    <!-- 자체 배너 - side-banner (ImageBanner) -->
    <div>
        <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">AD</span>
        </div>
        <ImageBanner
            position="sidebar"
            width="100%"
            height="250px"
            fallbackToAdsense={true}
            adsenseSlot={ADSENSE_SLOTS.square}
            adsenseFormat="rectangle"
        />
    </div>

    <!-- 이미지+텍스트 배너 (2x2 그리드) -->
    <div>
        <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">AD</span>
        </div>
        <ImageTextBanner position="side-image-text-banner" />
    </div>

    <!-- 나눔 게시판 위젯 (wr-giving) -->
    <div
        class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    >
        <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <svg class="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
            </svg>
            나눔 게시판
        </h3>
        <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <li class="hover:text-primary cursor-pointer truncate">
                • [진행중] 연말 특별 나눔 이벤트
            </li>
            <li class="hover:text-primary cursor-pointer truncate">• [마감] 기프티콘 나눔</li>
            <li class="hover:text-primary cursor-pointer truncate">• [진행중] 책 나눔합니다</li>
        </ul>
    </div>

    <!-- Sticky 광고 컨테이너 (PC 전용) -->
    <div
        class="hidden flex-col gap-4 lg:sticky lg:flex"
        style="top: 120px; margin-bottom: 20px; max-width: 288px;"
    >
        <!-- Square 배너 (280×280) -->
        <div>
            <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-medium text-slate-500">Sponsored</span>
            </div>
            <div
                class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
            >
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
                        class="flex h-[280px] w-[280px] animate-pulse items-center justify-center bg-slate-100 dark:bg-slate-700"
                    >
                        <span class="text-xs text-slate-400">Loading...</span>
                    </div>
                {/if}
            </div>
        </div>

        <!-- Halfpage 배너 (280×600 Sticky) -->
        <div>
            <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-medium text-slate-500">Sponsored</span>
            </div>
            <div
                class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
            >
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
                        class="flex h-[600px] w-[280px] animate-pulse items-center justify-center bg-slate-100 dark:bg-slate-700"
                    >
                        <span class="text-xs text-slate-400">Loading...</span>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
