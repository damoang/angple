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
    import { page } from '$app/stores';

    /** 삭제된 글/비밀글 상세 페이지에서는 모든 광고를 숨김 (애드센스 정책) */
    const isDeletedPost = $derived(!!($page as any).data?.post?.deleted_at);
    const isSecretPost = $derived(!!($page as any).data?.post?.is_secret);
    const suppressAds = $derived(isDeletedPost || isSecretPost);

    interface Props {
        position: string;
        height?: string;
        class?: string;
        sizes?: Array<[number, number]> | 'fluid';
        slotKey?: string;
    }

    let { position, height = '90px', class: className = '', sizes, slotKey }: Props = $props();

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

    // 모바일 목록처럼 터치가 빈번한 위치: no fill이어도 즉시 축소하지 않음 (CLS 방지)
    // 홈 공감글 터치 오인식(#11998) — 공감글 아래 위젯들이 index-middle 광고 높이 변화로 밀리는 것을 방지
    const TOUCH_SAFE_POSITIONS = new Set([
        'header-after',
        'board-list-infeed',
        'board-list-top',
        'board-list-bottom',
        'index-top',
        'index-middle-1',
        'index-middle-2',
        'board-content',
        'board-before-comments'
    ]);

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let showAdfit = $state(false);
    let slotId = $state('');
    let detached = false;
    let containerEl: HTMLDivElement | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    // 데스크톱 전용 position: 모바일/태블릿에서 GPT slot 초기화를 차단하여 무의미한 impression 방지
    const DESKTOP_ONLY_POSITIONS: Record<string, number> = {
        'wing-left': 1600,
        'wing-right': 1600,
        'sidebar-sticky-desktop': 1024,
        sidebar: 1536
    };

    let isBTF = $derived(BTF_POSITIONS.has(position));
    let isWing = $derived(position === 'wing-left' || position === 'wing-right');
    let isTouchSafe = $derived(TOUCH_SAFE_POSITIONS.has(position));
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

    function handleRender(isEmpty: boolean) {
        if (detached) return;
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
    }

    onMount(() => {
        void initAdSlot();
    });

    onDestroy(() => {
        detached = true;
        visibilityObserver?.disconnect();
        if (!slotId) return;
        adDensityStore.unregister(slotId);
        updateSlotVisibility(slotId, false);
        detachSlot(slotId, handleRender);
    });

    const reservedHeights = $derived(getReservedHeights(getAdConfig()));
    const suppressPlaceholder = $derived(position === 'wing-right' || position.includes('sidebar'));
    const effectiveMinHeight = $derived.by(() => {
        // 로드 전 + 사이드바 → 높이 예약 안 함
        if (!isLoaded && suppressPlaceholder) return '0px';
        // 터치 빈번한 목록 위치: 빈 광고라도 높이 유지 (CLS 방지)
        if (isEmpty && isTouchSafe) return 'var(--ad-slot-min-height)';
        // 일반: 빈 광고 → 축소
        if (isEmpty) return '0px';
        return 'var(--ad-slot-min-height)';
    });
</script>

{#if !suppressAds}
    <div
        bind:this={containerEl}
        class="ad-slot-container relative overflow-hidden rounded-lg {className}"
        class:ad-slot-loaded={isLoaded && hasAd}
        class:ad-slot-empty={isEmpty}
        class:ad-slot-empty-collapsed={isEmpty}
        class:ad-slot-btf={isBTF}
        style:--ad-slot-min-height={reservedHeights.base}
        style:--ad-slot-min-height-tablet={reservedHeights.tablet}
        style:--ad-slot-min-height-desktop={reservedHeights.desktop}
        style:--ad-slot-intrinsic-size={reservedHeights.desktop}
        style:min-height={effectiveMinHeight}
        style:transition="min-height 0ms"
    >
        {#if showAdfit && adfitUnit}
            <AdfitSlot unit={adfitUnit} id={slotId || position} />
        {/if}
        {#if slotId}
            <div
                id={slotId}
                class="gam-ad-slot w-full"
                style:min-height={effectiveMinHeight}
                style:display={showAdfit ? 'none' : undefined}
            ></div>
        {/if}
    </div>
{/if}

<style>
    .ad-slot-container {
        contain: layout style;
        /* transition은 inline style로 통일 (0ms) — CLS 방지 위해 즉시 적용 */
    }

    .ad-slot-btf {
        content-visibility: auto;
        contain-intrinsic-size: auto var(--ad-slot-intrinsic-size);
    }

    .ad-slot-loaded {
        border: 2px solid transparent;
        background: transparent;
    }

    .ad-slot-empty {
        border: 0;
        background: transparent;
    }

    .ad-slot-empty-collapsed {
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

        .ad-slot-empty,
        .ad-slot-empty .gam-ad-slot {
            min-height: 0 !important;
        }
    }

    @media (min-width: 970px) {
        .ad-slot-container,
        .gam-ad-slot {
            min-height: var(--ad-slot-min-height-desktop);
        }

        .ad-slot-empty,
        .ad-slot-empty .gam-ad-slot {
            min-height: 0 !important;
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
