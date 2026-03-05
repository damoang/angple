<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { aplogTrack } from '$lib/services/aplog';
    import { authStore } from '$lib/stores/auth.svelte';

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
        external_link?: string;
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

    // 최종 선택된 배너 (축하메시지 or 프리미엄 광고)
    let celebrationBanner = $state<CelebrationBanner | null>(null);
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

        if (showCelebration) {
            // 메인 페이지: 축하메시지 + 프리미엄 배너를 동시 fetch → 풀에서 랜덤 1개
            const [celebrations, adsBanners] = await Promise.all([
                fetchCelebrationBanners(),
                fetchAdsBanners()
            ]);

            // 슬롯 풀 구성:
            // - 축하메시지 N개 → 슬롯 1개 (내부 랜덤)
            // - 프리미엄 배너 각각 슬롯 1개씩
            type Slot =
                | { type: 'celebration'; data: CelebrationBanner }
                | { type: 'ads'; data: AdsBanner };
            const pool: Slot[] = [];

            if (celebrations.length > 0) {
                const picked = celebrations[Math.floor(Math.random() * celebrations.length)];
                pool.push({ type: 'celebration', data: picked });
            }
            for (const banner of adsBanners) {
                pool.push({ type: 'ads', data: banner });
            }

            if (pool.length > 0) {
                const selected = pool[Math.floor(Math.random() * pool.length)];
                if (selected.type === 'celebration') {
                    celebrationBanner = selected.data;
                } else {
                    adsBanner = selected.data;
                }
                loading = false;
                return;
            }
        } else {
            // 게시판 페이지: 프리미엄 + 일반 배너만 (축하메시지 없음)
            const ads = await fetchAdsBanners();
            if (ads.length > 0) {
                adsBanner = ads[Math.floor(Math.random() * ads.length)];
                loading = false;
                return;
            }
        }

        // 모두 없음 → GAM 폴백
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
                return result.data.filter(
                    (b: CelebrationBanner) => !b.display_type || b.display_type === 'image'
                );
            }
            return [];
        } catch (error) {
            console.warn('DamoangBanner: 축하메시지 로드 실패', error);
            return [];
        }
    }

    async function fetchAdsBanners(): Promise<AdsBanner[]> {
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

    // 축하메시지 배너 링크: API가 link_url에 올바른 경로를 반환 (/message/{wr_id} 등)
    function getCelebrationHref(banner: CelebrationBanner): string {
        return banner.link_url || `/message/${banner.id}`;
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
                mbId: authStore.user?.mb_id || null
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
        <!-- GAM 폴백 -->
        <AdSlot position={gamPosition} {height} />
    {/if}
</div>
