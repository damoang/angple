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
        isReady as isCelebrationReady,
        type CelebrationBanner
    } from '$lib/stores/celebration.svelte';
    import { getCachedBanners } from '$lib/stores/app-init.svelte';

    interface Props {
        position: 'index' | 'board-list' | 'board-view' | 'sidebar';
        showCelebration?: boolean; // 마음메시지 표시 여부 (메인만 true)
        height?: string;
        gamPosition?: string; // GAM 폴백 시 사용할 슬롯 이름 (위젯에서 전달)
        gamFallback?: boolean; // 자체 배너 없을 때 GAM 폴백 여부 (기본 true)
        class?: string;
    }

    let {
        position,
        showCelebration = true,
        height = '90px',
        gamPosition: gamPositionProp,
        gamFallback = true,
        class: className = ''
    }: Props = $props();

    // 트래킹은 브라우저→외부 직접 (sendBeacon은 Cloudflare 통과)
    const ADS_TRACKING_BASE = 'https://ads.damoang.net';

    // 다모앙 광고 배너 타입
    interface AdsBanner {
        id: string;
        imageUrl: string;
        mobileImageUrl?: string;
        landingUrl: string;
        altText?: string;
        target?: string;
        trackingId?: string;
        advertiserId?: string;
    }

    // 공유 스토어에서 마음메시지 가져오기
    let storeCelebrations = $derived(getCelebrations());
    let storeIndex = $derived(getCurrentIndex());
    let celebrationReady = $derived(isCelebrationReady());
    // 최종 선택된 배너 (마음메시지 or 프리미엄 광고)
    let adsBanner = $state<AdsBanner | null>(null);
    let loading = $state(true);
    let useFallback = $state(false);
    let adsResolved = $state(false);

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

    $effect(() => {
        if (!showCelebration) return;

        // 마음메시지가 이미 있으면(하이드레이션 시 SSR 시드) 자체광고 왕복을 기다리지 않고 즉시 표시.
        // 자체광고 우선순위는 celebrationBanner derived(adsBanner 있으면 null) + 템플릿 폴백 순서가
        // 유지 → 자체광고가 늦게 resolve 되면 자연 전환.
        const hasCelebration = celebrationReady && storeCelebrations.length > 0;
        if (hasCelebration) {
            loading = false;
            useFallback = false;
            return;
        }

        // 마음메시지가 없을 땐 자체광고 유무를 알아야 폴백(GAM/문구)을 정할 수 있으므로 adsResolved 대기.
        if (!adsResolved) {
            loading = true;
            return;
        }
        loading = !adsBanner && !celebrationReady;
        useFallback = !adsBanner && celebrationReady && storeCelebrations.length === 0;
    });

    onMount(() => {
        // 마음메시지: 공유 스토어에서 관리 (CelebrationRolling과 싱크)
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
            // 마음메시지는 공유 스토어에서 관리 → 광고만 fetch.
            // loading/useFallback 은 위 $effect 가 단일 소스로 계산(adsResolved 변화가 트리거).
            const ads = await fetchAdsBanners();
            if (ads.length > 0) {
                adsBanner = ads[Math.floor(Math.random() * ads.length)];
            }
            adsResolved = true;
        } else {
            // 게시판 페이지: 프리미엄 + 일반 배너만 (마음메시지 없음)
            const ads = await fetchAdsBanners();
            if (ads.length > 0) {
                adsBanner = ads[Math.floor(Math.random() * ads.length)];
            }
            adsResolved = true;
            loading = false;
            useFallback = !adsBanner;
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
                `/api/sidebar/items?position=${encodeURIComponent(adsPosition)}&limit=10`
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

    // 마음메시지 배너 링크: 공유 스토어의 getLink 사용
    function getCelebrationHref(banner: CelebrationBanner): string {
        return getCelebrationLink(banner);
    }
</script>

<div
    class="dm-card {className}"
    data-position={position}
    style:min-height={position === 'sidebar' ? height : undefined}
>
    {#if loading}
        <div
            aria-hidden="true"
            class="pointer-events-none invisible {position === 'sidebar'
                ? ''
                : 'aspect-[77/9] w-full'}"
            style:min-height={position === 'sidebar' ? height : undefined}
        ></div>
    {:else if celebrationBanner}
        <!-- 마음메시지 배너 -->
        <!-- index(가로형): 테두리 없이 비율(770×90=77/9)로 슬롯을 꽉 채워 레터박스 제거.
             sidebar: 기존 테두리 + 고정 높이 유지. -->
        <a
            href={getCelebrationHref(celebrationBanner)}
            class="dm-media-card block overflow-hidden rounded-xl transition-opacity hover:opacity-90 {position ===
            'sidebar'
                ? 'border-border border'
                : 'aspect-[77/9]'}"
            style:min-height={position === 'sidebar' ? height : undefined}
            style:height={position === 'sidebar' ? height : undefined}
        >
            <img
                src={celebrationBanner.image_url}
                alt={celebrationBanner.alt_text || '마음메시지'}
                class="dm-media-card__image w-full {position === 'sidebar'
                    ? 'object-contain'
                    : 'h-full object-cover'}"
                loading="lazy"
            />
        </a>
    {:else if adsBanner}
        <!-- 다모앙 자체 광고 배너 -->
        <!-- 광고 클릭은 새 탭으로 열어 사용자가 뒤로가기로 본 페이지로 복귀할 수 있게 함
             (기획팀 피드백: 광고 클릭 시 새 탭이 일반적이고 다모앙 이탈을 줄임) -->
        <a
            href={toLocalHref(adsBanner.landingUrl)}
            target="_blank"
            rel="noopener noreferrer"
            onclick={handleAdsClick}
            use:aplogTrack={{
                adId: adsBanner.id,
                adPos: adsPosition,
                imgSrc: adsBanner.imageUrl,
                mbId: authStore.user?.mb_id || null,
                slotKey: `damoang-banner:${position}`,
                adUserId: adsBanner.advertiserId ?? undefined
            }}
            class="dm-media-card block overflow-hidden rounded-xl transition-opacity hover:opacity-90 {position ===
            'sidebar'
                ? 'border-border border'
                : 'aspect-[77/9]'}"
            style:min-height={position === 'sidebar' ? height : undefined}
            style:height={position === 'sidebar' ? height : undefined}
        >
            {#if adsBanner.mobileImageUrl}
                <picture>
                    <source media="(max-width: 768px)" srcset={adsBanner.mobileImageUrl} />
                    <img
                        src={adsBanner.imageUrl}
                        alt={adsBanner.altText || '광고'}
                        class="dm-media-card__image w-full {position === 'sidebar'
                            ? 'object-contain'
                            : 'h-full object-cover'}"
                        loading="lazy"
                    />
                </picture>
            {:else}
                <img
                    src={adsBanner.imageUrl}
                    alt={adsBanner.altText || '광고'}
                    class="dm-media-card__image w-full {position === 'sidebar'
                        ? 'object-contain'
                        : 'h-full object-cover'}"
                    loading="lazy"
                />
            {/if}
        </a>
    {:else if useFallback}
        {#if position === 'sidebar'}
            <!-- 사이드바: 마음메시지/광고 없으면 빈 플레이스홀더 -->
            <div
                class="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30"
                style:min-height="40px"
            >
                <a
                    href="/message"
                    class="text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >마음메시지가 없습니다</a
                >
            </div>
        {:else if gamFallback}
            <!-- GAM 폴백 (gamFallback=true일 때만) -->
            <AdSlot position={gamPosition} {height} slotKey={`damoang-banner-${position}`} />
        {/if}
    {/if}
</div>

<style>
    .dm-media-card {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
    }

    .dm-media-card__image {
        display: block;
        width: 100%;
        height: 100%;
        max-height: inherit;
    }

    /* 사이드바: 200x200 이미지 원본 크기 유지 */
    :global(.dm-card[data-position='sidebar']) .dm-media-card {
        max-width: 200px;
        margin: 0 auto;
    }

    :global(.dm-card[data-position='sidebar']) .dm-media-card__image {
        width: auto;
        max-width: 200px;
    }

    /* 드로워 내 사이드바 배너: 320x100 (200px 제약 해제, 특이도 높임) */
    :global(.dm-card.drawer-sidebar-banner[data-position='sidebar']) .dm-media-card {
        max-width: 100%;
    }

    :global(.dm-card.drawer-sidebar-banner[data-position='sidebar']) .dm-media-card__image {
        width: 100%;
        max-width: 100%;
        height: 100px;
        object-fit: cover;
        object-position: center;
    }
</style>
