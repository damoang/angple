<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        position: string;
        width?: string;
        height?: string;
        class?: string;
        fallbackToAdsense?: boolean;
        adsenseSlot?: string;
        adsenseFormat?: string;
    }

    let {
        position,
        width = '100%',
        height = 'auto',
        class: className = '',
        fallbackToAdsense = true,
        adsenseSlot = '',
        adsenseFormat = 'auto'
    }: Props = $props();

    // API 베이스 URL (환경변수 또는 기본값)
    const API_BASE = import.meta.env.VITE_ADS_API_URL || 'https://ads.damoang.net';

    interface ServedBanner {
        id: string;
        imageUrl: string;
        landingUrl: string;
        altText: string;
        target: string;
        trackingId: string;
    }

    let banner = $state<ServedBanner | null>(null);
    let loading = $state(true);
    let showAdsense = $state(false);
    let impressionTracked = $state(false);

    onMount(() => {
        fetchBanner();
    });

    async function fetchBanner() {
        if (!browser) return;

        try {
            const response = await fetch(
                `${API_BASE}/api/v1/serve/banners?position=${encodeURIComponent(position)}`
            );
            const result = await response.json();

            if (result.success && result.data?.banners?.length > 0) {
                // 랜덤으로 하나 선택
                const banners = result.data.banners;
                banner = banners[Math.floor(Math.random() * banners.length)];
            } else {
                // 배너 없으면 애드센스 폴백
                if (fallbackToAdsense && adsenseSlot) {
                    showAdsense = true;
                    loadAdsense();
                }
            }
        } catch (error) {
            console.warn('Banner fetch error:', error);
            // 에러 시에도 애드센스 폴백
            if (fallbackToAdsense && adsenseSlot) {
                showAdsense = true;
                loadAdsense();
            }
        } finally {
            loading = false;
        }
    }

    // AdSense 설정 (ang-gnu 동일)
    const ADSENSE_CLIENT = 'ca-pub-5124617752473025';

    function loadAdsense() {
        if (!browser) return;

        const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
        }

        setTimeout(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.warn('AdSense push error:', e);
            }
        }, 100);
    }

    function trackImpression() {
        if (!banner || impressionTracked) return;
        impressionTracked = true;

        // Impression 트래킹
        if (banner.trackingId) {
            const img = new Image();
            img.src = `${API_BASE}/api/v1/track/impression?tid=${banner.trackingId}&t=${Date.now()}`;
        }
    }

    function handleClick() {
        if (!banner) return;

        // Click 트래킹
        if (banner.trackingId) {
            navigator.sendBeacon?.(
                `${API_BASE}/api/v1/track/click?tid=${banner.trackingId}&t=${Date.now()}`
            );
        }
    }

    function isVideo(url: string): boolean {
        return url?.toLowerCase().endsWith('.mp4') || url?.toLowerCase().endsWith('.webm');
    }

    // IntersectionObserver로 뷰포트 진입 시 impression 트래킹
    function observeImpression(node: HTMLElement) {
        if (!browser) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        trackImpression();
                        observer.disconnect();
                    }
                });
            },
            { threshold: 0.5 }
        );

        observer.observe(node);

        return {
            destroy() {
                observer.disconnect();
            }
        };
    }
</script>

<div
    class="image-banner {className}"
    style="width: {width}; min-height: {height};"
    data-position={position}
>
    {#if loading}
        <!-- 로딩 플레이스홀더 -->
        <div
            class="flex animate-pulse items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"
            style="min-height: {height};"
        >
            <svg
                class="h-8 w-8 text-slate-300 dark:text-slate-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
            </svg>
        </div>
    {:else if banner}
        <!-- 자체 배너 -->
        <a
            href={banner.landingUrl}
            target={banner.target || '_blank'}
            rel="nofollow noopener"
            onclick={handleClick}
            class="block overflow-hidden rounded-lg"
            use:observeImpression
        >
            {#if isVideo(banner.imageUrl)}
                <video
                    autoplay
                    loop
                    muted
                    playsinline
                    class="h-auto w-full rounded-lg"
                    style="max-width: 100%;"
                >
                    <source src={banner.imageUrl} type="video/mp4" />
                </video>
            {:else}
                <img
                    src={banner.imageUrl}
                    alt={banner.altText || '광고'}
                    class="h-auto w-full rounded-lg"
                    style="max-width: 100%;"
                    loading="eager"
                />
            {/if}
        </a>
    {:else if showAdsense && adsenseSlot}
        <!-- 애드센스 폴백 -->
        <div class="overflow-hidden rounded-lg">
            <ins
                class="adsbygoogle"
                style="display:block; width:{width}; min-height:{height};"
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={adsenseSlot}
                data-ad-format={adsenseFormat}
            ></ins>
        </div>
    {:else}
        <!-- 빈 상태 플레이스홀더 -->
        <div
            class="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
            style="min-height: {height};"
        >
            <div class="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
                <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                </svg>
                <span class="text-xs">AD</span>
            </div>
        </div>
    {/if}
</div>
