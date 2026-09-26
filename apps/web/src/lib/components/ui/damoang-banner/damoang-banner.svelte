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
    import { page } from '$app/state';

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

    // ─── SSR 시드: 첫 페인트부터 맞는 높이로 ─────────────────────────────────────
    // 레이아웃(+layout.server.ts)이 내려준 자체 배너 목록으로 **초기 상태를 여기서 확정**한다.
    // ⛔ $effect·onMount 는 서버에서 돌지 않는다. 여기서 정하지 않으면 SSR 은 항상 43px
    //    플레이스홀더(aspect 77/9)를 그리고, 클라이언트가 fetch 뒤 100px GAM 슬롯으로 **교체**하며
    //    tag-nav 이하 전부를 57px 민다(글 상세 모바일 CLS p75 0.002→0.076, 자체 배너 0건 기간에
    //    드러남). 시드가 있으면 43/100 이 첫 페인트부터 맞고 onMount fetch 도 생략한다.
    //    시드가 없으면(데이터 요청·ads 서버 실패) 예전 경로 그대로 — 악화 없음.
    // 사이드바는 min-height 예약이 있고 정상이라 손대지 않는다.
    const adsPositionInit = ADS_POSITION_MAP[position] || position;

    function readSeed(): AdsBanner[] | undefined {
        if (position === 'sidebar') return undefined;
        const layoutBanners = page.data?.banners as Record<string, AdsBanner[]> | null | undefined;
        const fromLayout = layoutBanners?.[adsPositionInit];
        if (Array.isArray(fromLayout)) return fromLayout;
        // SPA 네비게이션: 레이아웃은 null 을 내리지만 app-init 캐시(첫 SSR 시드·/api/init)는 남아 있다.
        if (browser) {
            const cached = getCachedBanners(adsPositionInit);
            if (Array.isArray(cached)) return cached as AdsBanner[];
        }
        return undefined;
    }

    // SSR 과 클라이언트가 **같은** 배너를 고르도록 경로 해시로 정한다(랜덤이면 하이드레이션 불일치).
    // 페이지마다 다른 배너가 걸리므로 노출은 여전히 분산된다.
    function pickBanner(list: AdsBanner[]): AdsBanner | null {
        if (list.length === 0) return null;
        const key = page.url?.pathname ?? '';
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
        return list[h % list.length] ?? null;
    }

    const seed = readSeed();
    const seedBanner = seed ? pickBanner(seed) : null;
    // 아래 $effect(showCelebration) / fetchBanners(그 외)와 **같은 규칙**으로 초기값을 계산한다.
    // ⛔ 마음메시지 유무는 모듈 스토어(getCelebrations)가 아니라 **page.data.celebration** 으로 본다.
    //    서버의 스토어는 요청 간에 남는 싱글턴이라(빈 배열로는 비워지지 않음) 어제 목록으로 SSR 을
    //    그릴 수 있고, 클라이언트는 오늘 데이터로 다른 분기를 잡아 하이드레이션이 어긋난다.
    //    page.data 는 SSR 과 클라이언트가 같은 값이다.
    //    그리고 마음메시지가 있을 때 SSR 은 이미지를 **확정하지 않고** 플레이스홀더(같은 43px)를 그린다 —
    //    롤링 인덱스가 무작위라 서버·클라가 다른 이미지를 고르기 때문. 높이는 같아 밀림이 없다.
    const seedCelebrationData = showCelebration
        ? (page.data?.celebration as unknown[] | null | undefined)
        : [];
    const seedCelebrationReady = Array.isArray(seedCelebrationData);
    const seedHasCelebration =
        showCelebration && seedCelebrationReady && seedCelebrationData.length > 0;
    let initialLoading: boolean;
    let initialFallback: boolean;
    if (showCelebration) {
        if (seed === undefined) {
            initialLoading = true;
            initialFallback = false;
        } else if (seedBanner) {
            initialLoading = false;
            initialFallback = false;
        } else if (seedHasCelebration) {
            // 플레이스홀더 → 클라이언트 $effect 가 마음메시지로 전환(같은 비율)
            initialLoading = true;
            initialFallback = false;
        } else {
            initialLoading = !seedCelebrationReady;
            initialFallback = seedCelebrationReady;
        }
    } else {
        initialLoading = seed === undefined;
        initialFallback = seed !== undefined && !seedBanner;
    }

    // 최종 선택된 배너 (마음메시지 or 프리미엄 광고)
    let adsBanner = $state<AdsBanner | null>(seedBanner);
    let loading = $state(initialLoading);
    let useFallback = $state(initialFallback);
    let adsResolved = $state(seed !== undefined);

    // 텍스트 롤링과 동일한 인덱스 사용 (싱크)
    let celebrationBanner = $derived.by<CelebrationBanner | null>(() => {
        if (!showCelebration || useFallback || adsBanner) return null;
        if (storeCelebrations.length === 0) return null;
        return storeCelebrations[storeIndex % storeCelebrations.length] ?? null;
    });

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

        // SSR 시드로 이미 확정됐으면 왕복하지 않는다 — 교체가 없어야 밀림이 없다.
        if (!adsResolved) fetchBanners();

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
            <!-- 사이드바: 보여줄 마음메시지가 없으면 **아무것도 그리지 않는다**.
                 점선 플레이스홀더는 빈 자리를 오히려 부각시켜 사이드바를 어수선하게 만들었다. -->
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
