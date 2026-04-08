<script lang="ts">
    import { onDestroy, onMount, tick } from 'svelte';
    import {
        AD_CONFIGS,
        AD_UNIT_PATHS,
        GAM_AD_EMPTY_RETRY_DELAY,
        GAM_AD_REFRESH_INTERVAL,
        POSITION_MAP,
        type AdConfig
    } from '$lib/config/ad-config.js';
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
        'comment-infeed'
    ]);

    // 모바일 목록처럼 터치가 빈번한 위치: no fill이어도 즉시 축소하지 않음 (CLS 방지)
    const TOUCH_SAFE_POSITIONS = new Set([
        'header-after',
        'board-list-infeed',
        'board-list-top',
        'board-list-bottom',
        'index-top',
        'board-content',
        'board-before-comments'
    ]);

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let slotId = $state('');
    let detached = false;
    let containerEl: HTMLDivElement | null = null;
    let visibilityObserver: IntersectionObserver | null = null;
    let isOutOfView = $state(false); // 뷰포트 밖으로 나갔는지
    let isBTF = $derived(BTF_POSITIONS.has(position));
    let isWing = $derived(position === 'wing-left' || position === 'wing-right');
    let isTouchSafe = $derived(TOUCH_SAFE_POSITIONS.has(position));
    let isEmpty = $derived(isLoaded && !hasAd);

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
        onSlotRendered(slotId, isEmpty, GAM_AD_EMPTY_RETRY_DELAY * 1000, 4);
    }

    async function initAdSlot() {
        detached = false;

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
                    // 터치 안전 위치: 뷰포트 밖으로 나가면 빈 슬롯 collapse 허용
                    if (isTouchSafe && isEmpty) {
                        isOutOfView = !entry.isIntersecting;
                    }
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
            refreshIntervalMs: GAM_AD_REFRESH_INTERVAL * 1000,
            emptyRetryDelayMs: GAM_AD_EMPTY_RETRY_DELAY * 1000,
            maxEmptyRetries: 4,
            onRender: handleRender
        });
    }

    onMount(() => {
        void initAdSlot();
    });

    onDestroy(() => {
        detached = true;
        visibilityObserver?.disconnect();
        if (!slotId) return;
        updateSlotVisibility(slotId, false);
        detachSlot(slotId, handleRender);
    });

    const reservedHeights = $derived(getReservedHeights(getAdConfig()));
    const suppressPlaceholder = $derived(position === 'wing-right' || position.includes('sidebar'));
    const effectiveMinHeight = $derived.by(() => {
        // 로드 전 + 사이드바 → 높이 예약 안 함
        if (!isLoaded && suppressPlaceholder) return '0px';
        // 터치 빈번한 목록 위치: 빈 광고라도 뷰포트 안에 있으면 높이 유지 (CLS 방지)
        if (isEmpty && isTouchSafe && !isOutOfView) return 'var(--ad-slot-min-height)';
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
        style:transition="min-height 300ms ease-out"
    >
        {#if slotId}
            <div id={slotId} class="gam-ad-slot w-full" style:min-height={effectiveMinHeight}></div>
        {/if}
    </div>
{/if}

<style>
    .ad-slot-container {
        contain: layout style;
        /* transition은 inline style로 통일 (300ms ease-out) — CSS와 충돌 방지 */
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
