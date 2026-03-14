<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { aplogTrack } from '$lib/services/aplog';
    import { authStore } from '$lib/stores/auth.svelte';
    import {
        mount as celebrationMount,
        getCelebrations,
        getCurrentIndex,
        getLink as getCelebrationLink,
        type CelebrationBanner
    } from '$lib/stores/celebration.svelte';
    import { getCachedBanners } from '$lib/stores/app-init.svelte';

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

    // 트래킹은 브라우저→외부 직접 (sendBeacon은 Cloudflare 통과)
    const ADS_TRACKING_BASE = 'https://ads.damoang.net';

    // 다모앙 광고 배너 타입
    interface AdsBanner {
        id: string;
        imageUrl: string;
        landingUrl: string;
        altText?: string;
        target?: string;
        trackingId?: string;
    }

    // 공유 스토어에서 축하메시지 가져오기
    let storeCelebrations = $derived(getCelebrations());
    let storeIndex = $derived(getCurrentIndex());
    // 최종 선택된 배너 (축하메시지 or 프리미엄 광고)
    let adsBanner = $state<AdsBanner | null>(null);
    let loading = $state(true);
    let useFallback = $state(false);

    // 텍스트 롤링과 동일한 인덱스 사용 (싱크)
    let celebrationBanner = $derived.by<CelebrationBanner | null>(() => {
        if (!showCelebration || useFallback || adsBanner) return null;
        if (storeCelebrations.length === 0) return null;
        return storeCelebrations[storeIndex % storeCelebrations.length] ?? null;
    });

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
        // 축하메시지: 공유 스토어에서 관리 (CelebrationRolling과 싱크)
        let cleanupCelebration: (() => void) | undefined;
        if (showCelebration) {
            cleanupCelebration = celebrationMount();
        }

        fetchBanners();

        return () => {
            cleanupCelebration?.();
        };
    });

    async function fetchBanners() {
        if (!browser) return;

        if (showCelebration) {
            // 축하메시지는 공유 스토어에서 관리 → 광고만 fetch
            const ads = await fetchAdsBanners();
            if (ads.length > 0) {
                adsBanner = ads[Math.floor(Math.random() * ads.length)];
            }
            // celebrationBanner는 $derived로 스토어에서 자동 반영
            loading = false;
            // 축하메시지도 광고도 없으면 GAM 폴백
            // 스토어가 아직 안 불렸을 수 있으므로 짧게 대기 후 체크
            if (!adsBanner && storeCelebrations.length === 0) {
                // 100ms만 대기 후 재확인 (기존 500ms → 빠른 폴백)
                await new Promise((r) => setTimeout(r, 100));
                if (!adsBanner && storeCelebrations.length === 0) {
                    useFallback = true;
                }
            }
        } else {
            // 게시판 페이지: 프리미엄 + 일반 배너만 (축하메시지 없음)
            const ads = await fetchAdsBanners();
            if (ads.length > 0) {
                adsBanner = ads[Math.floor(Math.random() * ads.length)];
                loading = false;
                return;
            }
            useFallback = true;
            loading = false;
        }
    }

    async function fetchAdsBanners(): Promise<AdsBanner[]> {
        // app-init 캐시에서 먼저 확인
        const cached = getCachedBanners(adsPosition);
        if (cached && cached.length > 0) {
            return cached as AdsBanner[];
        }

        try {
            const response = await fetch(
                `/api/ads/banners?position=${encodeURIComponent(adsPosition)}&limit=10`
            );

            if (!response.ok) return [];

            const result = await response.json();

            if (result.success && result.data?.banners?.length > 0) {
                return result.data.banners;
            }
            return [];
        } catch (error) {
            console.warn('DamoangBanner: 다모앙 광고 로드 실패', error);
            return [];
        }
    }

    function handleAdsClick() {
        if (adsBanner?.trackingId) {
            navigator.sendBeacon?.(
                `${ADS_TRACKING_BASE}/api/v1/track/click?tid=${adsBanner.trackingId}&t=${Date.now()}`
            );
        }
    }

    // 외부 절대 URL을 현재 도메인 상대 경로로 변환
    function toLocalHref(raw: string): string {
        if (!raw || raw === '#') return raw;
        try {
            const url = new URL(raw, browser ? window.location.origin : 'https://localhost');
            if (
                browser &&
                (url.hostname === window.location.hostname || url.hostname.endsWith('damoang.net'))
            ) {
                return url.pathname + url.search + url.hash;
            }
        } catch {
            // 파싱 실패 시 원본
        }
        return raw;
    }

    // 축하메시지 배너 링크: 공유 스토어의 getLink 사용
    function getCelebrationHref(banner: CelebrationBanner): string {
        return getCelebrationLink(banner);
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
    {:else if celebrationBanner}
        <!-- 축하메시지 배너 -->
        <a
            href={getCelebrationHref(celebrationBanner)}
            class="border-border block overflow-hidden rounded-xl border transition-opacity hover:opacity-90"
        >
            <img
                src={celebrationBanner.image_url}
                alt={celebrationBanner.alt_text || '축하메시지'}
                class="w-full object-contain"
                style:max-height={height}
                loading="lazy"
            />
        </a>
    {:else if adsBanner}
        <!-- 다모앙 자체 광고 배너 -->
        <a
            href={toLocalHref(adsBanner.landingUrl)}
            onclick={handleAdsClick}
            use:aplogTrack={{
                adId: adsBanner.id,
                adPos: adsPosition,
                imgSrc: adsBanner.imageUrl,
                mbId: authStore.user?.mb_id || null,
                slotKey: `damoang-banner:${position}`
            }}
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
        {#if position === 'sidebar'}
            <!-- 사이드바: 축하메시지/광고 없으면 빈 플레이스홀더 -->
            <div
                class="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30"
                style:min-height="40px"
            >
                <p class="text-[10px] text-slate-400 dark:text-slate-500">축하메시지가 없습니다</p>
            </div>
        {:else}
            <!-- GAM 폴백 -->
            <AdSlot position={gamPosition} {height} slotKey={`damoang-banner-${position}`} />
        {/if}
    {/if}
</div>
