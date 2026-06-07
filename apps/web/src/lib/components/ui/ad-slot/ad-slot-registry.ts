import { browser } from '$app/environment';
import { GAM_SITE_NAME, POSITION_REFRESH_INTERVALS, type AdConfig } from '$lib/config/ad-config.js';
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
    fallbackTriggered: boolean;
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
    onFallback?: () => void;
};

type Registry = {
    slots: Map<string, SlotState>;
    callbacks: Map<string, Set<(isEmpty: boolean) => void>>;
    fallbackCallbacks: Map<string, () => void>;
    servicesEnabled: boolean;
    listenerRegistered: boolean;
    gptReadyPromise: Promise<boolean> | null;
};

function createRegistry(): Registry {
    return {
        slots: new Map(),
        callbacks: new Map(),
        fallbackCallbacks: new Map(),
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

/**
 * GAM `gpt.js` <link rel="preload"> 삽입 (canary 사용자만 호출됨).
 * audit P0-B (4-2, 5/22 미팅 직결). preconnect 와 별도로 LCP 직후 즉시 사용 가능하도록.
 * CSP `script-src` 가 `securepubads.g.doubleclick.net` 이미 허용 (hooks.server.ts:528) → 추가 변경 불필요.
 */
export function ensureGAMPreload() {
    if (!browser) return;
    const href = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
    if (document.querySelector(`link[rel="preload"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = href;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
}

/**
 * Watchdog 강제 empty render — `slotRenderEnded` 가 N초 내 도착하지 않을 때 호출.
 * 이미 loaded 된 slot 은 무시. AdFit fallback 트리거를 위해 emptyRetry max 까지 누적.
 * audit §2-4 / §5-D / P0-B.
 */
export function forceEmptyRender(slotId: string) {
    if (!browser) return;
    const registry = getRegistry();
    const state = registry.slots.get(slotId);
    if (!state) return;
    if (state.loaded) return;
    state.loaded = true;
    state.empty = true;
    emitRender(slotId, true);
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

        // #12595: SafeFrame OFF (PR #1568) 후에도 일부 광고에서 iframe 내부 scrollbar
        // 발생. 특히 in-flow 컨테이너 (728×90 reserved) 에 더 큰 creative (예: 250×250)
        // 가 들어오면 iframe 안에 scroll 가 생겨 사용자 페이지 스크롤 포커스를 가로챔.
        // GPT 가 만든 iframe element 의 scrolling 속성 + overflow style 강제로 차단.
        if (!event.isEmpty) {
            try {
                const container = document.getElementById(slotId);
                const iframe = container?.querySelector(
                    'iframe[id^="google_ads_iframe"]'
                ) as HTMLIFrameElement | null;
                if (iframe) {
                    iframe.setAttribute('scrolling', 'no');
                    iframe.style.overflow = 'hidden';
                }

                // #12628: overflow-y visible 전환(#1578) 후, 예약 높이(min-height)보다 큰
                // creative(비디오 등)가 아래 콘텐츠 위로 흘러내려 제목을 가리는 문제.
                // overflow 로 자르는 대신(잘림=AdSense 정책 위반, auto=스크롤바 #12595)
                // 컨테이너 min-height 를 creative 렌더 높이만큼 올려 sizing 으로 해결한다.
                // - 늘리기만 하고 줄이지 않음 (refresh 로 작은 creative 가 와도 layout shift 최소화)
                // - fluid/1x1 creative 는 event.size 가 무의미 → iframe 실측 높이 fallback
                let creativeHeight = Array.isArray(event.size) ? Number(event.size[1]) || 0 : 0;
                if (creativeHeight <= 1 && iframe) {
                    creativeHeight = iframe.offsetHeight || 0;
                }
                if (container && creativeHeight > 1) {
                    const frame = container.closest('.dm-display-frame') as HTMLElement | null;
                    for (const el of [container, frame]) {
                        if (!el) continue;
                        const current = parseFloat(getComputedStyle(el).minHeight) || 0;
                        if (creativeHeight > current) {
                            el.style.minHeight = `${creativeHeight}px`;
                        }
                    }
                }
            } catch {
                // best-effort: GPT iframe 없거나 권한 부족 시 silent skip
            }
        }

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
    // #12595: SafeFrame 비활성화 — 게시판 목록 in-flow 광고 (board-list-infeed) 의
    // creative height 가 reserved (90px) 보다 큰 경우 SafeFrame iframe 내부에 scrollbar 가
    // 생성되어 사용자의 페이지 스크롤 포커스를 가로채는 문제 해결. SafeFrame off 시
    // GAM 이 standard iframe (scrolling="no") 으로 렌더하여 내부 scroll 미발생.
    googletag.pubads().setForceSafeFrame(false);
    googletag.pubads().setTargeting('site', GAM_SITE_NAME);
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    googletag.pubads().setTargeting('theme', theme);
    // 시간대/디바이스 targeting — GAM Pricing Rule에서 동적 floor 설정에 활용
    googletag.pubads().setTargeting('hour', String(new Date().getHours()));
    googletag
        .pubads()
        .setTargeting(
            'device',
            window.innerWidth >= 1024 ? 'desktop' : window.innerWidth >= 728 ? 'tablet' : 'mobile'
        );
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
                // CLS 방지: 리프레시 시 현재 높이를 min+max로 고정해 광고 확장/축소 시 스크롤 점프 차단
                const currentHeight = container.offsetHeight;
                container.style.minHeight = `${currentHeight}px`;
                container.style.maxHeight = `${currentHeight}px`;
                // 5초 후 maxHeight 해제 (새 광고 로딩 후 충분한 시간)
                setTimeout(() => {
                    container.style.maxHeight = '';
                }, 5000);
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
    if (state.emptyRetryTimer) return;
    if (state.emptyRetryCount >= maxRetries) {
        // retry 소진 → 애드핏 폴백 트리거
        if (!state.fallbackTriggered) {
            state.fallbackTriggered = true;
            const registry = getRegistry();
            const fallbackCb = registry.fallbackCallbacks.get(state.slotId);
            fallbackCb?.();
        }
        return;
    }

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
            viewable: false,
            fallbackTriggered: false
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

    if (options.onFallback) {
        registry.fallbackCallbacks.set(slotId, options.onFallback);
    }

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
            registry.fallbackCallbacks.delete(slotId);
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
