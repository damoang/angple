import { browser } from '$app/environment';
import { GAM_SITE_NAME, type AdConfig } from '$lib/config/ad-config.js';
import { getCurrentPageContext, setCurrentPageContext, trackEvent } from '$lib/services/ga4.js';
import { queueGoogleTagCommand } from '$lib/utils/gpt-loader';

const REGISTRY_KEY = '__gam_slot_registry__';
const DESTROY_DELAY_MS = 1500;

type SlotSizes = Array<[number, number]> | 'fluid';

type SlotState = {
    key: string;
    position: string;
    slotId: string;
    slot: googletag.Slot | null;
    config: AdConfig;
    sizes: SlotSizes;
    refreshIntervalMs: number;
    mountCount: number;
    empty: boolean;
    loaded: boolean;
    refreshTimer: ReturnType<typeof setTimeout> | null;
    emptyRetryTimer: ReturnType<typeof setTimeout> | null;
    emptyRetryCount: number;
    destroyTimer: ReturnType<typeof setTimeout> | null;
    visible: boolean;
    viewable: boolean;
};

type SlotAttachOptions = {
    key: string;
    position: string;
    sizes: SlotSizes;
    config: AdConfig;
    refreshIntervalMs: number;
    emptyRetryDelayMs: number;
    maxEmptyRetries: number;
    onRender: (isEmpty: boolean) => void;
};

type Registry = {
    slots: Map<string, SlotState>;
    callbacks: Map<string, Set<(isEmpty: boolean) => void>>;
    servicesEnabled: boolean;
    listenerRegistered: boolean;
    gptReadyPromise: Promise<boolean> | null;
};

function createRegistry(): Registry {
    return {
        slots: new Map(),
        callbacks: new Map(),
        servicesEnabled: false,
        listenerRegistered: false,
        gptReadyPromise: null
    };
}

function ensureAdNetworkPreconnect() {
    if (!browser) return;

    const origins = [
        'https://securepubads.g.doubleclick.net',
        'https://pagead2.googlesyndication.com',
        'https://tpc.googlesyndication.com'
    ];

    for (const origin of origins) {
        if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) continue;
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    }
}

function getRegistry(): Registry {
    if (!browser) return createRegistry();
    const win = window as Window & { [REGISTRY_KEY]?: Registry };
    if (!win[REGISTRY_KEY]) {
        win[REGISTRY_KEY] = createRegistry();
    }
    return win[REGISTRY_KEY]!;
}

function emitRender(slotId: string, isEmpty: boolean) {
    const registry = getRegistry();
    const callbacks = registry.callbacks.get(slotId);
    if (!callbacks) return;
    callbacks.forEach((callback) => callback(isEmpty));
}

function ensureSlotListener() {
    const registry = getRegistry();
    if (registry.listenerRegistered) return;

    googletag.pubads().addEventListener('slotRenderEnded', (event) => {
        const slotId = event.slot.getSlotElementId();
        const state = registry.slots.get(slotId);
        if (!state) return;

        state.loaded = true;
        state.empty = event.isEmpty;
        state.viewable = false;
        const pageContext = getCurrentPageContext();
        trackEvent('ad_impression', {
            slot_id: slotId,
            slot_key: state.key,
            position: state.position,
            page_type: pageContext.pageType,
            board_id: pageContext.boardId,
            is_empty: event.isEmpty
        });
        emitRender(slotId, event.isEmpty);
    });

    googletag.pubads().addEventListener('impressionViewable', (event) => {
        const slotId = event.slot.getSlotElementId();
        const state = registry.slots.get(slotId);
        if (!state || state.empty) return;

        state.viewable = true;
        scheduleViewableRefresh(state, state.refreshIntervalMs);
    });

    registry.listenerRegistered = true;
}

function ensureServices() {
    const registry = getRegistry();
    if (registry.servicesEnabled) return;

    googletag.pubads().collapseEmptyDivs();
    googletag.pubads().enableSingleRequest();
    googletag.setConfig({
        lazyLoad: {
            fetchMarginPercent: 400,
            renderMarginPercent: 150,
            mobileScaling: 0.75
        }
    });
    googletag.pubads().setCentering(true);
    googletag.pubads().setTargeting('site', GAM_SITE_NAME);
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    googletag.pubads().setTargeting('theme', theme);
    googletag.enableServices();
    registry.servicesEnabled = true;
}

function defineSlot(
    slotId: string,
    config: AdConfig,
    sizes: SlotSizes,
    position: string,
    key: string
): googletag.Slot | null {
    let slot: googletag.Slot | null;

    if (sizes === 'fluid') {
        slot = googletag.defineSlot(config.unit, ['fluid'], slotId);
    } else {
        slot = googletag.defineSlot(config.unit, sizes as googletag.GeneralSize, slotId);
    }

    if (!slot) return null;

    if (config.responsive) {
        const mapping = googletag.sizeMapping();
        for (const [viewport, slotSizes] of config.responsive) {
            mapping.addSize([viewport, 0], slotSizes as googletag.GeneralSize);
        }
        const built = mapping.build();
        if (built) {
            slot.defineSizeMapping(built);
        }
    }

    slot.setTargeting('position', position);
    slot.setTargeting('slot_key', key);
    slot.addService(googletag.pubads());
    return slot;
}

async function ensureGPTReady(): Promise<boolean> {
    if (!browser) return false;

    const registry = getRegistry();
    if (window.googletag?.apiReady) return true;

    ensureAdNetworkPreconnect();

    if (!registry.gptReadyPromise) {
        registry.gptReadyPromise = new Promise<boolean>((resolve) => {
            const timeout = setTimeout(() => {
                registry.gptReadyPromise = null;
                resolve(false);
            }, 10000);

            const finish = (ready: boolean) => {
                clearTimeout(timeout);
                resolve(ready);
            };

            if (window.googletag?.apiReady) {
                finish(true);
                return;
            }

            const existingScript = document.querySelector(
                'script[src*="securepubads.g.doubleclick.net"]'
            );
            if (existingScript) {
                const readyCheck = setInterval(() => {
                    if (window.googletag?.apiReady) {
                        clearInterval(readyCheck);
                        finish(true);
                    }
                }, 100);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
            script.async = true;
            script.onload = () => {
                const readyCheck = setInterval(() => {
                    if (window.googletag?.apiReady) {
                        clearInterval(readyCheck);
                        finish(true);
                    }
                }, 100);
            };
            script.onerror = () => {
                registry.gptReadyPromise = null;
                finish(false);
            };
            document.head.appendChild(script);
        });
    }

    return await registry.gptReadyPromise;
}

function scheduleViewableRefresh(state: SlotState, intervalMs = 0) {
    if (state.refreshTimer || intervalMs <= 0) return;
    if (!state.slot || state.empty || state.mountCount <= 0 || !state.visible || !state.viewable)
        return;

    state.refreshTimer = setTimeout(() => {
        state.refreshTimer = null;

        queueGoogleTagCommand(() => {
            if (
                !state.slot ||
                state.empty ||
                state.mountCount <= 0 ||
                !state.visible ||
                !state.viewable
            )
                return;

            const container = document.getElementById(state.slotId)?.parentElement;
            if (container) {
                container.style.minHeight = `${container.offsetHeight}px`;
            }

            // CLS best practice: 광고 리프레시 시 포커스 보존
            const activeEl = document.activeElement as HTMLElement | null;
            const hadFocus = activeEl && activeEl !== document.body;

            state.viewable = false;
            googletag.pubads().refresh([state.slot], { changeCorrelator: false });

            if (hadFocus && activeEl) {
                requestAnimationFrame(() => {
                    if (document.activeElement === document.body && activeEl.isConnected) {
                        activeEl.focus({ preventScroll: true });
                    }
                });
            }
        });
    }, intervalMs);
}

function clearSlotTimers(state: SlotState) {
    if (state.refreshTimer) {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = null;
    }
    if (state.emptyRetryTimer) {
        clearTimeout(state.emptyRetryTimer);
        state.emptyRetryTimer = null;
    }
    if (state.destroyTimer) {
        clearTimeout(state.destroyTimer);
        state.destroyTimer = null;
    }
}

function scheduleEmptyRetry(state: SlotState, delayMs: number, maxRetries: number) {
    if (state.emptyRetryTimer || state.emptyRetryCount >= maxRetries) return;

    state.emptyRetryTimer = setTimeout(() => {
        state.emptyRetryTimer = null;
        state.emptyRetryCount += 1;

        queueGoogleTagCommand(() => {
            if (!state.slot || state.mountCount <= 0) return;
            googletag.pubads().refresh([state.slot], { changeCorrelator: false });
        });
    }, delayMs);
}

export function buildSlotId(position: string, slotKey: string) {
    return `gam-${position}-${slotKey}`;
}

export async function attachSlot(options: SlotAttachOptions) {
    if (!browser) return null;

    const gptReady = await ensureGPTReady();
    if (!gptReady) return null;

    window.googletag = window.googletag || { cmd: [] };
    const registry = getRegistry();
    const slotId = buildSlotId(options.position, options.key);

    let state = registry.slots.get(slotId);
    if (!state) {
        state = {
            key: options.key,
            position: options.position,
            slotId,
            slot: null,
            config: options.config,
            sizes: options.sizes,
            refreshIntervalMs: options.refreshIntervalMs,
            mountCount: 0,
            empty: false,
            loaded: false,
            refreshTimer: null,
            emptyRetryTimer: null,
            emptyRetryCount: 0,
            destroyTimer: null,
            visible: false,
            viewable: false
        };
        registry.slots.set(slotId, state);
    }

    state.mountCount += 1;
    state.config = options.config;
    state.sizes = options.sizes;
    state.refreshIntervalMs = options.refreshIntervalMs;
    state.position = options.position;

    if (!registry.callbacks.has(slotId)) {
        registry.callbacks.set(slotId, new Set());
    }
    registry.callbacks.get(slotId)!.add(options.onRender);

    if (state.destroyTimer) {
        clearTimeout(state.destroyTimer);
        state.destroyTimer = null;
    }

    queueGoogleTagCommand(() => {
        ensureSlotListener();
        ensureServices();

        if (!state!.slot) {
            state!.slot = defineSlot(
                slotId,
                options.config,
                options.sizes,
                options.position,
                options.key
            );
            if (!state!.slot) return;
            googletag.display(slotId);
        } else if (state!.loaded || state!.mountCount > 1) {
            googletag.pubads().refresh([state!.slot], { changeCorrelator: false });
        }

        scheduleViewableRefresh(state!, state!.refreshIntervalMs);
        if (state!.loaded) {
            emitRender(slotId, state!.empty);
        }
        if (state!.loaded && state!.empty) {
            scheduleEmptyRetry(state!, options.emptyRetryDelayMs, options.maxEmptyRetries);
        }
    });

    return {
        slotId,
        state
    };
}

export function onSlotRendered(
    slotId: string,
    isEmpty: boolean,
    emptyRetryDelayMs: number,
    maxRetries: number
) {
    const registry = getRegistry();
    const state = registry.slots.get(slotId);
    if (!state) return;

    state.loaded = true;
    state.empty = isEmpty;
    if (isEmpty) {
        scheduleEmptyRetry(state, emptyRetryDelayMs, maxRetries);
        return;
    }

    if (state.emptyRetryTimer) {
        clearTimeout(state.emptyRetryTimer);
        state.emptyRetryTimer = null;
    }
    state.emptyRetryCount = 0;
}

export function detachSlot(slotId: string, onRender: (isEmpty: boolean) => void) {
    if (!browser) return;

    const registry = getRegistry();
    const callbacks = registry.callbacks.get(slotId);
    callbacks?.delete(onRender);
    if (callbacks && callbacks.size === 0) {
        registry.callbacks.delete(slotId);
    }

    const state = registry.slots.get(slotId);
    if (!state) return;

    state.mountCount = Math.max(0, state.mountCount - 1);
    if (state.mountCount > 0) return;

    if (state.destroyTimer) {
        clearTimeout(state.destroyTimer);
    }

    state.destroyTimer = setTimeout(() => {
        queueGoogleTagCommand(() => {
            if (!state.slot || state.mountCount > 0) return;

            clearSlotTimers(state);
            googletag.destroySlots([state.slot]);
            registry.slots.delete(slotId);
            registry.callbacks.delete(slotId);
        });
    }, DESTROY_DELAY_MS);
}

export function updateSlotVisibility(slotId: string, visible: boolean) {
    if (!browser) return;

    const registry = getRegistry();
    const state = registry.slots.get(slotId);
    if (!state) return;
    state.visible = visible;

    if (!visible && state.refreshTimer) {
        clearTimeout(state.refreshTimer);
        state.refreshTimer = null;
        return;
    }

    if (visible) {
        scheduleViewableRefresh(state, state.refreshIntervalMs);
    }
}

export function updatePageTargeting(pathname: string) {
    if (!browser || !window.googletag) return;

    const { pageType, boardId } = setCurrentPageContext(pathname);

    queueGoogleTagCommand(() => {
        googletag.pubads().setTargeting('page_type', pageType);
        googletag.pubads().setTargeting('board_id', boardId);
    });
}
