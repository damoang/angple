<script lang="ts">
    import { onDestroy, onMount, tick } from 'svelte';
    import {
        AD_CONFIGS,
        AD_UNIT_PATHS,
        GAM_AD_EMPTY_RETRY_DELAY,
        GAM_AD_REFRESH_INTERVAL,
        POSITION_MAP,
        POSITION_REFRESH_INTERVALS,
        ADFIT_FALLBACK_MAP,
        ADFIT_FALLBACK_MAX_RETRIES,
        type AdConfig
    } from '$lib/config/ad-config.js';
    import AdfitSlot from '$lib/components/ui/adfit-slot/adfit-slot.svelte';
    import { adDensityStore } from '$lib/stores/ad-density.svelte.js';
    import {
        attachSlot,
        buildSlotId,
        detachSlot,
        onSlotRendered,
        updateSlotVisibility
    } from './ad-slot-registry.js';
    import {
        isInCanary,
        isInPreloadCanary,
        PHASE_B1_SLOTS,
        PREBID_BIDDERS_DEFAULT,
        PREBID_SIZES_BY_POSITION
    } from '$lib/ads/prebid-config.js';
    import { runPrebidAuction } from '$lib/ads/prebid-loader.js';
    import { ensureGAMPreload } from './ad-slot-registry.js';
    import { trackAdEvent, isAdSdkBlocked } from '$lib/services/ad-telemetry.js';
    import { page } from '$app/stores';
    import { hooks } from '@angple/hook-system';

    /**
     * Watchdog: `attachSlot` 후 N ms 내 `slotRenderEnded` 가 도착하지 않으면
     * 강제 `handleRender(true)` 호출 → empty path → emptyRetry → AdFit fallback.
     * audit §2-4 / §5-D / P0-B (5/22 미팅 직결: fill rate 측정 정확도 ↑).
     * 12s 는 audit 권장값. lazyLoad fetchMargin=400% 이라 일반 광고는 충분히 먼저 응답.
     */
    const AD_WATCHDOG_MS = 12_000;

    interface Props {
        position: string;
        height?: string;
        class?: string;
        sizes?: Array<[number, number]> | 'fluid';
        slotKey?: string;
    }

    let { position, height = '90px', class: className = '', sizes, slotKey }: Props = $props();

    /** 삭제된 글/비밀글/성인 키워드 글/차단 작가 글 상세 페이지에서는 모든 광고를 숨김 (애드센스 정책) */
    const isDeletedPost = $derived(!!($page as any).data?.post?.deleted_at);
    const isSecretPost = $derived(!!($page as any).data?.post?.is_secret);
    const isAdultPost = $derived(!!($page as any).data?.post?.is_adult);
    const isSuppressedAuthor = $derived(!!($page as any).data?.post?.suppress_ads);
    // WP 모델: 플러그인이 should_render_ad filter 에 등록 → false 반환 시 광고 OFF (ad-free 멤버십 등)
    const pluginSuppress = $derived(
        hooks.applyFilters('should_render_ad', true, {
            slotName: position,
            user: ($page as any).data?.user ?? null,
            // PC viewport (≥970px) 일 때만 ad-free 같은 plugin 이 광고 OFF 가능.
            // 모바일/태블릿은 default true 유지 → 다모앙 자체 광고앙 배너 + AdSense 정상 노출.
            isDesktop: typeof window !== 'undefined' && window.innerWidth >= 970
        }) === false
    );
    const suppressAds = $derived(
        isDeletedPost || isSecretPost || isAdultPost || isSuppressedAuthor || pluginSuppress
    );

    const BTF_POSITIONS = new Set([
        'board-list-bottom',
        'board-footer',
        'index-bottom',
        'explore-bottom',
        'empathy-bottom',
        'board-list-infeed',
        'comment-infeed',
        'board-after-comments'
    ]);

    // 모든 슬롯(in-flow + sidebar/wing)이 빈 광고 상태에서도 예약 공간을 유지한다 → CLS 완전 제거.
    // sidebar/wing 은 모바일/좁은 뷰포트에서 stylesheet 미디어쿼리로 0px 로 무너져
    // 모바일 사용자에게는 빈 공간이 보이지 않는다 (parent aside `hidden` 이중 안전장치).

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let showAdfit = $state(false);
    let slotId = $state('');
    let detached = false;
    let containerEl: HTMLDivElement | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    // 데스크톱 전용 position: 모바일/태블릿에서 GPT slot 초기화를 차단하여 무의미한 impression 방지
    const DESKTOP_ONLY_POSITIONS: Record<string, number> = {
        'wing-left': 1600,
        'wing-right': 1600,
        'sidebar-sticky-desktop': 1024,
        sidebar: 1536
    };

    let isBTF = $derived(BTF_POSITIONS.has(position));
    let isWing = $derived(position === 'wing-left' || position === 'wing-right');
    let isSidebar = $derived(position.includes('sidebar'));
    /**
     * 부유(side/wing) 슬롯 — 모바일·좁은 뷰포트에서 부모 레이아웃이 `hidden`
     * 처리하지만, 광고 영역 자체도 viewport 가 임계 미만일 때는 0px 로 무너져야
     * 모바일 사용자에게 빈 공간이 보이지 않는다. (부모 hidden 이중 안전장치)
     */
    let isFloating = $derived(isWing || isSidebar);
    let isEmpty = $derived(isLoaded && !hasAd && !showAdfit);

    // 애드핏 폴백 유닛 (반응형: 데스크톱/모바일 구분)
    const adfitConfig = $derived(ADFIT_FALLBACK_MAP[position] ?? null);
    const adfitUnit = $derived.by(() => {
        if (!adfitConfig) return null;
        if (typeof window === 'undefined') return adfitConfig.desktop;
        return window.innerWidth >= 728 ? adfitConfig.desktop : adfitConfig.mobile;
    });

    function handleFallback() {
        if (detached || !adfitUnit) return;
        if (!adDensityStore.canShowMore) return;
        showAdfit = true;
    }

    function getAdConfig(): AdConfig {
        const configKey = POSITION_MAP[position];
        if (configKey && AD_CONFIGS[configKey]) {
            return AD_CONFIGS[configKey];
        }

        return {
            unit: AD_UNIT_PATHS.sub,
            sizes: (sizes as Array<[number, number]>) || [
                [728, 90],
                [320, 100]
            ],
            responsive: [
                [728, [[728, 90]]],
                [0, [[320, 100]]]
            ]
        };
    }

    function parseHeightPx(value: string): number | null {
        const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
        if (!match) return null;
        return Number(match[1]);
    }

    function maxHeight(sizes: Array<[number, number]>): number {
        return Math.max(...sizes.map((size) => size[1]));
    }

    function getReservedHeights(config: AdConfig): {
        base: string;
        tablet: string;
        desktop: string;
    } {
        const explicitHeight = parseHeightPx(height);
        const fallback = explicitHeight ?? (config.sizes.length > 0 ? maxHeight(config.sizes) : 0);
        let mobileHeight = fallback;
        let tabletHeight: number | null = null;
        let desktopHeight: number | null = null;

        if (config.responsive) {
            for (const [viewport, viewportSizes] of config.responsive) {
                if (viewportSizes.length === 0) continue;
                const reserved = Math.max(maxHeight(viewportSizes), explicitHeight ?? 0);

                if (viewport >= 970) {
                    desktopHeight = Math.max(desktopHeight ?? fallback, reserved);
                } else if (viewport >= 728) {
                    tabletHeight = Math.max(tabletHeight ?? fallback, reserved);
                } else {
                    mobileHeight = Math.max(mobileHeight, reserved);
                }
            }
        }

        const base = mobileHeight;
        const tablet = tabletHeight ?? base;
        const desktop = desktopHeight ?? tablet;

        return {
            base: `${base}px`,
            tablet: `${tablet}px`,
            desktop: `${desktop}px`
        };
    }

    function clearWatchdog() {
        if (watchdogTimer) {
            clearTimeout(watchdogTimer);
            watchdogTimer = null;
        }
    }

    function handleRender(isEmpty: boolean) {
        if (detached) return;
        clearWatchdog();
        isLoaded = true;
        hasAd = !isEmpty;
        // GAM이 나중에 채워지면 애드핏 숨기기
        if (!isEmpty && showAdfit) {
            showAdfit = false;
        }
        // 광고 밀도 관리
        if (!isEmpty) {
            adDensityStore.register(slotId);
        }
        const maxRetries = adfitConfig ? ADFIT_FALLBACK_MAX_RETRIES : 4;
        onSlotRendered(slotId, isEmpty, GAM_AD_EMPTY_RETRY_DELAY * 1000, maxRetries);
    }

    async function initAdSlot() {
        detached = false;

        // 데스크톱 전용 슬롯: viewport가 임계값 미만이면 GPT 호출 차단
        const minWidth = DESKTOP_ONLY_POSITIONS[position];
        if (minWidth && typeof window !== 'undefined' && window.innerWidth < minWidth) {
            return;
        }

        const config = getAdConfig();
        const adSizes = sizes || config.sizes;
        const resolvedSlotKey = slotKey || position;

        slotId = buildSlotId(position, resolvedSlotKey);

        await tick();

        if (containerEl && typeof IntersectionObserver !== 'undefined') {
            visibilityObserver?.disconnect();
            visibilityObserver = new IntersectionObserver(
                ([entry]) => {
                    updateSlotVisibility(slotId, entry.isIntersecting);
                },
                {
                    threshold: isWing ? 0.1 : 0.5,
                    rootMargin: isWing ? '200px 0px 200px 0px' : '0px'
                }
            );
            visibilityObserver.observe(containerEl);
        } else {
            updateSlotVisibility(slotId, true);
        }

        // Phase B-1: canary 그룹 + 적용 대상 slot 인 경우 Prebid auction 먼저 실행.
        // 실패/timeout 시 silent fallback → GAM 만 사용 (기존 동작 유지).
        if (PHASE_B1_SLOTS.has(position)) {
            const userKey = ($page as any).data?.user?.mb_id ?? slotId;
            if (isInCanary(userKey)) {
                try {
                    await runPrebidAuction({
                        code: slotId,
                        sizes: PREBID_SIZES_BY_POSITION[position] ?? adSizes,
                        bidders: PREBID_BIDDERS_DEFAULT
                    });
                } catch {
                    /* GAM 폴백 */
                }
            }
        }

        // P0-B canary 5%: GAM gpt.js <link rel="preload"> 삽입 (5/22 미팅 직결).
        // hash(mb_id) 기반 안정적 분류 — 같은 사용자는 항상 같은 결과.
        // 비로그인은 slotId 사용 (페이지/포지션마다 분산되어 통계적으로 ~5%).
        const preloadKey = ($page as any).data?.user?.mb_id ?? slotId;
        if (isInPreloadCanary(preloadKey)) {
            ensureGAMPreload();
        }

        await attachSlot({
            key: resolvedSlotKey,
            position,
            sizes: adSizes,
            config,
            refreshIntervalMs:
                (POSITION_REFRESH_INTERVALS[position] ?? GAM_AD_REFRESH_INTERVAL) * 1000,
            emptyRetryDelayMs: GAM_AD_EMPTY_RETRY_DELAY * 1000,
            maxEmptyRetries: adfitConfig ? ADFIT_FALLBACK_MAX_RETRIES : 4,
            onRender: handleRender,
            onFallback: adfitConfig ? handleFallback : undefined
        });

        // P0-B watchdog: attachSlot 후 12s 내 slotRenderEnded 안 오면 강제 empty.
        // 이미 detached 또는 loaded 상태면 setup 자체 skip.
        if (!detached && !isLoaded) {
            clearWatchdog();
            watchdogTimer = setTimeout(() => {
                watchdogTimer = null;
                if (detached || isLoaded) return;
                // P1-C (5/22 미팅 직결): GAM/AdFit SDK 둘 다 부재 → 광고 차단기 추정
                if (isAdSdkBlocked()) {
                    trackAdEvent('ad_sdk_blocked', {
                        position,
                        reason: 'no_googletag_no_adfit'
                    });
                }
                handleRender(true);
            }, AD_WATCHDOG_MS);
        }
    }

    onMount(() => {
        void initAdSlot();
    });

    onDestroy(() => {
        detached = true;
        clearWatchdog();
        visibilityObserver?.disconnect();
        if (!slotId) return;
        adDensityStore.unregister(slotId);
        updateSlotVisibility(slotId, false);
        detachSlot(slotId, handleRender);
    });

    /**
     * 모든 슬롯(in-flow + sidebar/wing)에서 예약 공간 유지 → CLS 완전 제거.
     *
     * - in-flow 슬롯: 모든 viewport 에서 `--ad-slot-min-height` 유지.
     * - 부유(sidebar/wing) 슬롯: 부모 레이아웃이 좁은 viewport 에서 `hidden` 처리하므로
     *   거기서는 자연히 노출 없음. 부모가 마운트한 경우 (≥1024 sidebar / ≥1600 wing)
     *   에만 reserved 사이즈만큼 공간 확보 (CSS 미디어쿼리로 활성화) → 광고 도착 시
     *   위에 그대로 렌더(움직임 없음), 광고 부재 시 투명 빈 공간 유지.
     *
     * 디자인 결정: PR #1354 후속 — 사용자 요청 "CLS 아예 없애기".
     * 빈 공간은 placeholder UI 없이 투명하게 두어 광고 부재가 거슬리지 않도록 한다.
     *
     * `min-height` 자체는 inline 으로 지정하지 않고 stylesheet 규칙에서 관리한다
     * (floating 슬롯의 미디어쿼리 기반 0px ↔ reserved 전환을 inline 우선순위가
     * 깨뜨리지 않도록).
     */
    const reservedHeights = $derived(getReservedHeights(getAdConfig()));
</script>

{#if !suppressAds}
    <div
        bind:this={containerEl}
        class="ad-slot-container relative overflow-hidden rounded-lg {className}"
        class:ad-slot-loaded={isLoaded && hasAd}
        class:ad-slot-empty={isEmpty}
        class:ad-slot-empty-collapsed={isEmpty}
        class:ad-slot-btf={isBTF}
        class:ad-slot-wing={isWing}
        class:ad-slot-sidebar={isSidebar}
        class:ad-slot-floating={isFloating}
        style:--ad-slot-min-height={reservedHeights.base}
        style:--ad-slot-min-height-tablet={reservedHeights.tablet}
        style:--ad-slot-min-height-desktop={reservedHeights.desktop}
        style:--ad-slot-floating-reserved={reservedHeights.desktop}
        style:--ad-slot-intrinsic-size={reservedHeights.desktop}
        style:transition="min-height 0ms"
    >
        {#if showAdfit && adfitUnit}
            <AdfitSlot unit={adfitUnit} id={slotId || position} {position} />
        {/if}
        {#if slotId}
            <div
                id={slotId}
                class="gam-ad-slot w-full"
                style:display={showAdfit ? 'none' : undefined}
            ></div>
        {/if}
    </div>
{/if}

<style>
    .ad-slot-container {
        contain: layout style;
        /* 기본 (모바일/in-flow): inline 으로 주입된 --ad-slot-min-height 사용 */
        min-height: var(--ad-slot-min-height);
        /* transition은 inline style로 통일 (0ms) — CLS 방지 위해 즉시 적용 */
    }
    .gam-ad-slot {
        min-height: var(--ad-slot-min-height);
    }

    .ad-slot-btf {
        content-visibility: auto;
        contain-intrinsic-size: auto var(--ad-slot-intrinsic-size);
    }

    .ad-slot-loaded {
        border: 2px solid transparent;
        background: transparent;
    }

    /*
     * 빈 광고 상태: collapse 하지 않고 예약 공간(min-height)을 유지하여 CLS 방지.
     * 시각적으로는 투명하므로 사용자에게는 빈 공간으로 보이며, 광고가 채워지면
     * 그 위에 그대로 렌더된다. (사이드바/윙 등 floating 위치도 동일하게 예약 공간을
     * 유지하되, 모바일/좁은 뷰포트에서는 미디어쿼리로 0px 처리되어 자연 collapse.)
     */
    .ad-slot-empty {
        border: 0;
        background: transparent;
    }

    .ad-slot-empty-collapsed {
        /* 시각적 placeholder UI 없이 투명 빈 공간 유지 (가장 보수적) */
        opacity: 0;
    }

    :global(.dark) .ad-slot-loaded,
    :global(.amoled) .ad-slot-loaded {
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 0.5rem;
    }

    .gam-ad-slot {
        display: flex;
        justify-content: center;
        align-items: center;
        max-width: 100%;
        overflow: hidden;
    }

    @media (min-width: 728px) {
        .ad-slot-container,
        .gam-ad-slot {
            min-height: var(--ad-slot-min-height-tablet);
        }
    }

    @media (min-width: 970px) {
        .ad-slot-container,
        .gam-ad-slot {
            min-height: var(--ad-slot-min-height-desktop);
        }
    }

    /*
     * 부유 광고(side/wing) 모바일/좁은 뷰포트 보호:
     * 부모 layout 이 `hidden` 처리하지만, 직접 렌더되더라도 viewport 가
     * 임계 미만일 때는 0px 로 무너져 모바일에 빈 공간이 보이지 않는다.
     *
     * - 사이드바: 1024px(lg) 이상에서 노출 (parent aside `hidden lg:flex`)
     * - 윙(left/right): 1600px 이상에서 노출 (parent aside `hidden min-[1600px]:block`)
     *
     * 위 728/970 미디어쿼리(in-flow tablet/desktop)는 in-flow 슬롯 전용이고
     * floating 슬롯은 아래 규칙으로 덮어쓴다.
     */
    .ad-slot-floating,
    .ad-slot-floating .gam-ad-slot {
        min-height: 0;
    }
    @media (min-width: 1024px) {
        .ad-slot-sidebar,
        .ad-slot-sidebar .gam-ad-slot {
            min-height: var(--ad-slot-floating-reserved);
        }
    }
    @media (min-width: 1600px) {
        .ad-slot-wing,
        .ad-slot-wing .gam-ad-slot {
            min-height: var(--ad-slot-floating-reserved);
        }
    }

    .gam-ad-slot :global(iframe) {
        max-width: 100% !important;
    }

    :global(.dark) .gam-ad-slot :global(iframe),
    :global(.amoled) .gam-ad-slot :global(iframe) {
        filter: brightness(0.9);
    }
</style>
