<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';

    interface Props {
        position: 'index' | 'board-list' | 'board-view' | 'sidebar';
        showCelebration?: boolean; // 축하메시지 표시 여부 (메인만 true)
        height?: string;
        gamPosition?: string; // GAM 폴백 시 사용할 슬롯 이름 (위젯에서 전달)
        class?: string;
    }

    let {
        position,
        showCelebration = true,
        height = '90px',
        gamPosition: gamPositionProp,
        class: className = ''
    }: Props = $props();

    // API 엔드포인트
    // 축하메시지 API는 SvelteKit에서 처리 (상대 경로 사용)
    const DAMOANG_API_BASE = '';
    // 트래킹은 브라우저→외부 직접 (sendBeacon은 Cloudflare 통과)
    const ADS_TRACKING_BASE = 'https://ads.damoang.net';

    // 축하메시지 배너 타입
    interface CelebrationBanner {
        id: number;
        image_url: string;
        link_url: string;
        alt_text?: string;
        target?: string;
        display_type?: 'image' | 'text';
    }

    // 다모앙 광고 배너 타입
    interface AdsBanner {
        id: string;
        imageUrl: string;
        landingUrl: string;
        altText?: string;
        target?: string;
        trackingId?: string;
    }

    let celebrationBanners = $state<CelebrationBanner[]>([]);
    let currentBannerIndex = $state(0);
    let adsBanner = $state<AdsBanner | null>(null);
    let loading = $state(true);
    let useFallback = $state(false);

    // position → 다모앙 광고 서버 position 매핑
    // index → index-top (메인 페이지용, 현재 배너 0개 → GAM 폴백)
    // board-list/board-view → board-head (게시판/글 페이지용)
    // sidebar → sidebar (사이드바용)
    const ADS_POSITION_MAP: Record<string, string> = {
        index: 'index-top',
        'board-list': 'board-head',
        'board-view': 'board-head',
        sidebar: 'sidebar'
    };

    // position → GAM 슬롯 위치 매핑
    const GAM_POSITION_MAP: Record<string, string> = {
        index: 'index-head',
        'board-list': 'board-list-head',
        'board-view': 'board-content',
        sidebar: 'sidebar'
    };

    const adsPosition = $derived(ADS_POSITION_MAP[position] || position);
    const gamPosition = $derived(gamPositionProp || GAM_POSITION_MAP[position] || 'board-head');

    onMount(() => {
        fetchBanners();
    });

    async function fetchBanners() {
        if (!browser) return;

        // 1. 축하메시지 (showCelebration=true인 경우만)
        if (showCelebration) {
            const banners = await fetchCelebrationBanners();
            if (banners.length > 0) {
                celebrationBanners = banners;
                loading = false;
                return;
            }
        }

        // 2. 다모앙 광고 서버 (ads.damoang.net)
        const ads = await fetchAdsBanner();
        if (ads) {
            adsBanner = ads;
            loading = false;
            return;
        }

        // 3. 모두 실패 → GAM 폴백
        useFallback = true;
        loading = false;
    }

    async function fetchCelebrationBanners(): Promise<CelebrationBanner[]> {
        try {
            const response = await fetch(`${DAMOANG_API_BASE}/api/ads/celebration/today`, {
                method: 'GET',
                headers: { Accept: 'application/json' }
            });

            if (!response.ok) return [];

            const result = await response.json();

            if (result.success && result.data?.length > 0) {
                // display_type === 'image'인 것만 필터링 (text 타입은 CelebrationRolling에서 처리)
                const imageBanners = result.data.filter(
                    (b: CelebrationBanner) => !b.display_type || b.display_type === 'image'
                );
                return imageBanners;
            }
            return [];
        } catch (error) {
            console.warn('DamoangBanner: 축하메시지 로드 실패', error);
            return [];
        }
    }

    async function fetchAdsBanner(): Promise<AdsBanner | null> {
        try {
            const response = await fetch(
                `/api/ads/banners?position=${encodeURIComponent(adsPosition)}&limit=1`
            );

            if (!response.ok) return null;

            const result = await response.json();

            if (result.success && result.data?.banners?.length > 0) {
                return result.data.banners[0];
            }
            return null;
        } catch (error) {
            console.warn('DamoangBanner: 다모앙 광고 로드 실패', error);
            return null;
        }
    }

    function handleAdsClick() {
        if (adsBanner?.trackingId) {
            navigator.sendBeacon?.(
                `${ADS_TRACKING_BASE}/api/v1/track/click?tid=${adsBanner.trackingId}&t=${Date.now()}`
            );
        }
    }

    // 5초 자동 롤링
    $effect(() => {
        if (celebrationBanners.length <= 1) return;
        const id = setInterval(() => {
            currentBannerIndex = (currentBannerIndex + 1) % celebrationBanners.length;
        }, 5000);
        return () => clearInterval(id);
    });

    // 터치 스와이프
    let touchStartX = 0;
    function handleTouchStart(e: TouchEvent) {
        touchStartX = e.touches[0].clientX;
    }
    function handleTouchEnd(e: TouchEvent) {
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            currentBannerIndex =
                diff > 0
                    ? (currentBannerIndex + 1) % celebrationBanners.length
                    : (currentBannerIndex - 1 + celebrationBanners.length) %
                      celebrationBanners.length;
        }
    }
</script>

<div class="damoang-banner {className}" data-position={position}>
    {#if loading}
        <!-- 로딩 중 플레이스홀더 -->
        <div
            class="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50"
            style:min-height={height}
        >
            <div class="flex flex-col items-center gap-1.5 text-center">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">AD</span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500">로딩 중...</span>
            </div>
        </div>
    {:else if celebrationBanners.length > 0}
        <!-- 축하메시지 캐러셀 -->
        <div
            class="border-border relative overflow-hidden rounded-xl border"
            ontouchstart={handleTouchStart}
            ontouchend={handleTouchEnd}
        >
            {#each celebrationBanners as banner, i (banner.id)}
                <a
                    href={banner.link_url}
                    target={banner.target || '_blank'}
                    rel="nofollow noopener"
                    class="w-full transition-transform duration-500 ease-in-out {i ===
                    currentBannerIndex
                        ? 'relative block translate-x-0'
                        : i < currentBannerIndex
                          ? 'absolute inset-0 block -translate-x-full'
                          : 'absolute inset-0 block translate-x-full'}"
                >
                    <img
                        src={banner.image_url}
                        alt={banner.alt_text || '축하메시지'}
                        class="w-full object-contain"
                        style:max-height={height}
                        loading="lazy"
                    />
                </a>
            {/each}
            {#if celebrationBanners.length > 1}
                <div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                    {#each celebrationBanners as _, i}
                        <button
                            class="h-2 w-2 rounded-full transition-colors {i === currentBannerIndex
                                ? 'bg-white'
                                : 'bg-white/50'}"
                            onclick={() => (currentBannerIndex = i)}
                            aria-label="배너 {i + 1}번으로 이동"
                        ></button>
                    {/each}
                </div>
            {/if}
        </div>
    {:else if adsBanner}
        <!-- 다모앙 자체 광고 배너 -->
        <a
            href={adsBanner.landingUrl}
            target={adsBanner.target || '_blank'}
            rel="nofollow noopener"
            onclick={handleAdsClick}
            class="border-border block overflow-hidden rounded-xl border transition-opacity hover:opacity-90"
        >
            <img
                src={adsBanner.imageUrl}
                alt={adsBanner.altText || '광고'}
                class="w-full object-contain"
                style:max-height={height}
                loading="lazy"
            />
        </a>
    {:else if useFallback}
        <!-- GAM 폴백 -->
        <AdSlot position={gamPosition} {height} />
    {/if}
</div>
