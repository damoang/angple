import { browser } from '$app/environment';
import { GAM_SITE_NAME, type AdConfig } from '$lib/config/ad-config.js';

const REGISTRY_KEY = '__gam_slot_registry__';
const DESTROY_DELAY_MS = 1500;

type SlotSizes = Array<[number, number]> | 'fluid';

type SlotState = {
    key: string;
    slotId: string;
    slot: googletag.Slot | null;
    config: AdConfig;
    sizes: SlotSizes;
    mountCount: number;
    empty: boolean;
    loaded: boolean;
    refreshTimer: ReturnType<typeof setInterval> | null;
    emptyRetryTimer: ReturnType<typeof setTimeout> | null;
    emptyRetryCount: number;
    destroyTimer: ReturnType<typeof setTimeout> | null;
    visible: boolean;
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
    gptReadyPromise: Promise<void> | null;
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
        emitRender(slotId, event.isEmpty);
    });

    registry.listenerRegistered = true;
}

function ensureServices() {
    const registry = getRegistry();
    if (registry.servicesEnabled) return;

    googletag.pubads().collapseEmptyDivs();
    googletag.pubads().enableLazyLoad({
        fetchMarginPercent: 200,
        renderMarginPercent: 100,
        mobileScaling: 2
    });
    googletag.pubads().setCentering(true);
    googletag.pubads().setTargeting('site', GAM_SITE_NAME);
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    googletag.pubads().setTargeting('theme', theme);
    googletag.enableServices();
    registry.servicesEnabled = true;
}

function defineSlot(slotId: string, config: AdConfig, sizes: SlotSizes): googletag.Slot | null {
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

    slot.addService(googletag.pubads());
    return slot;
}

async function ensureGPTReady() {
    if (!browser) return;

    const registry = getRegistry();
    if (window.googletag?.apiReady) return;

    if (!registry.gptReadyPromise) {
        registry.gptReadyPromise = new Promise<void>((resolve) => {
            if (window.googletag?.apiReady) {
                resolve();
                return;
            }

            const existingScript = document.querySelector(
                'script[src*="securepubads.g.doubleclick.net"]'
            );
            if (existingScript) {
                const readyCheck = setInterval(() => {
                    if (window.googletag?.apiReady) {
                        clearInterval(readyCheck);
                        resolve();
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
                        resolve();
                    }
                }, 100);
            };
            document.head.appendChild(script);
        });
    }

    await registry.gptReadyPromise;
}

function scheduleAutoRefresh(state: SlotState, intervalMs: number) {
    if (state.refreshTimer || intervalMs <= 0) return;

    state.refreshTimer = setInterval(() => {
        googletag.cmd.push(() => {
            if (!state.slot || state.empty || state.mountCount <= 0 || !state.visible) return;
            googletag.pubads().refresh([state.slot], { changeCorrelator: false });
        });
    }, intervalMs);
}

function clearSlotTimers(state: SlotState) {
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
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

        googletag.cmd.push(() => {
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

    await ensureGPTReady();

    window.googletag = window.googletag || { cmd: [] };
    const registry = getRegistry();
    const slotId = buildSlotId(options.position, options.key);

    let state = registry.slots.get(slotId);
    if (!state) {
        state = {
            key: options.key,
            slotId,
            slot: null,
            config: options.config,
            sizes: options.sizes,
            mountCount: 0,
            empty: false,
            loaded: false,
            refreshTimer: null,
            emptyRetryTimer: null,
            emptyRetryCount: 0,
            destroyTimer: null,
            visible: false
        };
        registry.slots.set(slotId, state);
    }

    state.mountCount += 1;
    state.config = options.config;
    state.sizes = options.sizes;

    if (!registry.callbacks.has(slotId)) {
        registry.callbacks.set(slotId, new Set());
    }
    registry.callbacks.get(slotId)!.add(options.onRender);

    if (state.destroyTimer) {
        clearTimeout(state.destroyTimer);
        state.destroyTimer = null;
    }

    googletag.cmd.push(() => {
        ensureSlotListener();
        ensureServices();

        if (!state!.slot) {
            state!.slot = defineSlot(slotId, options.config, options.sizes);
            if (!state!.slot) return;
            googletag.display(slotId);
        } else if (state!.loaded || state!.mountCount > 1) {
            googletag.pubads().refresh([state!.slot], { changeCorrelator: false });
        }

        scheduleAutoRefresh(state!, options.refreshIntervalMs);
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
        googletag.cmd.push(() => {
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
}
