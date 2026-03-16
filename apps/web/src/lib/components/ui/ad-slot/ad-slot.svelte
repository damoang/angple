<script lang="ts">
    import { onDestroy, onMount, tick } from 'svelte';
    import {
        AD_CONFIGS,
        AD_UNIT_PATHS,
        GAM_AD_EMPTY_RETRY_DELAY,
        GAM_AD_REFRESH_INTERVAL,
        POSITION_LABELS,
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

    interface Props {
        position: string;
        height?: string;
        class?: string;
        sizes?: Array<[number, number]> | 'fluid';
        slotKey?: string;
    }

    let { position, height = '90px', class: className = '', sizes, slotKey }: Props = $props();

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let slotId = $state('');
    let detached = false;
    let containerEl: HTMLDivElement | null = null;
    let visibilityObserver: IntersectionObserver | null = null;

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
        onSlotRendered(slotId, isEmpty, GAM_AD_EMPTY_RETRY_DELAY * 1000, 3);
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
                },
                { threshold: 0.5 }
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
            maxEmptyRetries: 3,
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
</script>

<div
    bind:this={containerEl}
    class="ad-slot-container relative overflow-hidden rounded-lg transition-all duration-300 {className}"
    class:ad-slot-placeholder={!isLoaded}
    class:ad-slot-loaded={isLoaded && hasAd}
    style:--ad-slot-min-height={reservedHeights.base}
    style:--ad-slot-min-height-tablet={reservedHeights.tablet}
    style:--ad-slot-min-height-desktop={reservedHeights.desktop}
    style:min-height="var(--ad-slot-min-height)"
>
    {#if slotId}
        <div
            id={slotId}
            class="gam-ad-slot w-full"
            style="min-height: var(--ad-slot-min-height);"
        ></div>
    {/if}

    {#if !isLoaded}
        <div
            class="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/50"
        >
            <div class="flex flex-col items-center gap-1.5 text-center">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">AD</span>
                <span class="text-[10px] text-slate-400 dark:text-slate-500">
                    {POSITION_LABELS[position] || position}
                </span>
            </div>
        </div>
    {/if}
</div>

<style>
    .ad-slot-placeholder {
        background: linear-gradient(135deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%);
        border: 2px dashed #cbd5e1;
    }

    :global(.dark) .ad-slot-placeholder {
        background: linear-gradient(135deg, #334155 0%, #475569 50%, #334155 100%);
        border-color: #475569;
    }

    .ad-slot-loaded {
        border: none;
        background: transparent;
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

    .gam-ad-slot:empty {
        display: none;
    }

    .gam-ad-slot :global(iframe) {
        max-width: 100% !important;
    }

    :global(.dark) .gam-ad-slot :global(iframe),
    :global(.amoled) .gam-ad-slot :global(iframe) {
        filter: brightness(0.9);
    }
</style>
