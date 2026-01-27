<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { hooks } from '@angple/hook-system';

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

    // 배너 API 설정 인터페이스
    interface BannerApiConfig {
        apiUrl: string;
        trackViewUrl: (id: number) => string;
        trackClickUrl: (id: number) => string;
    }

    // 백엔드 BannerResponse 타입
    interface BannerResponse {
        id: number;
        title: string;
        image_url: string;
        link_url: string;
        position: string;
        priority: number;
        is_active: boolean;
        click_count: number;
        view_count: number;
        alt_text?: string;
        target: string;
        created_at: string;
    }

    // 내부에서 사용할 정규화된 배너 타입
    interface NormalizedBanner {
        id: number;
        imageUrl: string;
        linkUrl: string;
        altText: string;
        target: string;
    }

    let banner = $state<NormalizedBanner | null>(null);
    let loading = $state(true);
    let showAdsense = $state(false);
    let impressionTracked = $state(false);
    let apiConfig = $state<BannerApiConfig | null>(null);

    onMount(() => {
        // 플러그인에서 배너 API 설정을 제공하는지 확인
        // 플러그인이 없으면 null 반환 → 애드센스 폴백
        apiConfig = hooks.applyFilters('banner_api_config', null, { position });
        fetchBanner();
    });

    // 백엔드 응답을 정규화된 형태로 변환
    function normalizeBanner(b: BannerResponse): NormalizedBanner {
        return {
            id: b.id,
            imageUrl: b.image_url,
            linkUrl: b.link_url,
            altText: b.alt_text || b.title || '광고',
            target: b.target || '_blank'
        };
    }

    async function fetchBanner() {
        if (!browser) return;

        // 플러그인이 API 설정을 제공하지 않으면 애드센스 폴백
        if (!apiConfig) {
            loading = false;
            if (fallbackToAdsense && adsenseSlot) {
                showAdsense = true;
                loadAdsense();
            }
            return;
        }

        try {
            const response = await fetch(
                `${apiConfig.apiUrl}?position=${encodeURIComponent(position)}`
            );
            const result = await response.json();

            // position 파라미터가 있으면 data.banners, 없으면 data 자체가 배열
            const banners: BannerResponse[] = result.data?.banners || result.data || [];

            if (banners.length > 0) {
                // priority로 정렬 후 랜덤 선택 (같은 priority 내에서)
                const sorted = [...banners].sort((a, b) => b.priority - a.priority);
                const topPriority = sorted[0].priority;
                const topBanners = sorted.filter((b) => b.priority === topPriority);
                const selected = topBanners[Math.floor(Math.random() * topBanners.length)];
                banner = normalizeBanner(selected);
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
        if (!banner || impressionTracked || !apiConfig) return;
        impressionTracked = true;

        // View 트래킹
        fetch(apiConfig.trackViewUrl(banner.id), {
            method: 'POST',
            credentials: 'include'
        }).catch((err) => console.warn('View tracking failed:', err));
    }

    function handleClick() {
        if (!banner || !apiConfig) return;

        // Click 트래킹
        navigator.sendBeacon?.(apiConfig.trackClickUrl(banner.id));
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
            href={banner.linkUrl}
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
