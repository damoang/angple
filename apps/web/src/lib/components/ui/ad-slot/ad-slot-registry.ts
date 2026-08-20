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
    /** bug/13656: 편집 포커스 때문에 연속으로 미룬 refresh 횟수 (상한 도달 시 강제 refresh) */
    focusDeferCount: number;
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

/**
 * 광고 슬롯 확장 관측 — 2026-08-20.
 *
 * ⛔ 왜: 실사용자 CWV 에서 CLS 1위 원인이 **광고 슬롯 확장**으로 좁혀졌다.
 *    밀린 요소(largestShiftTarget) 상위가 `#comments`(기여 65.4) · `footer`(41.2) ·
 *    본문 — 전부 **광고 아래에 있는 것들**이다. 즉 위에서 무언가 커졌다는 뜻이고,
 *    아래 `grewBy > 0` 경로가 정확히 그 "커짐" 이다.
 *    바로 아래 주석(#12632)이 이미 인정하고 있다: "확장은 layout shift 를 만든다".
 *
 * ⛔ 그런데 **예약값을 얼마로 올려야 하는지 데이터가 없다.** 어떤 크기의 creative 가
 *    실제로 오는지 모른 채 예약을 키우면 광고 없을 때 빈 공간만 커진다.
 *    그래서 고치기 전에 잰다 — 2026-08-19 하이드레이션에서 배운 순서다
 *    (데이터 없이 세운 가설이 네 번 연속 죽었다).
 *
 * ⛔ 프런트를 늦추지 않는다:
 *    - 확장이 실제로 일어난 순간에만 보낸다. 대부분의 로드에서 전송 0건.
 *    - 표본은 **페이지 단위로 한 번** 결정한다. 슬롯마다 따로 뽑으면 같은 페이지의
 *      슬롯들을 함께 볼 수 없어 "이 페이지에서 무엇이 얼마나 밀었나" 를 못 센다.
 *    - sendBeacon — 응답을 기다리지 않는다.
 */
const AD_EXPAND_DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';
const AD_EXPAND_SAMPLE_RATE = 0.1;
let adExpandSampled: boolean | null = null;
let adExpandSent = 0;
/** 한 페이지에서 너무 많이 보내지 않는다 — 슬롯 수만큼이면 충분하다 */
const AD_EXPAND_MAX_PER_PAGE = 8;

function reportAdExpansion(
    slotId: string,
    reserved: number,
    creative: number,
    grewBy: number,
    inViewport: boolean
): void {
    try {
        if (adExpandSampled === null) adExpandSampled = Math.random() < AD_EXPAND_SAMPLE_RATE;
        if (!adExpandSampled || adExpandSent >= AD_EXPAND_MAX_PER_PAGE) return;
        adExpandSent++;
        const payload = {
            type: 'ad_slot_expand',
            reason: 'expanded',
            channel: 'gpt',
            message: `ad slot expand ${slotId}`,
            // ⛔ 수집기는 스키마에 없는 필드를 버린다(js_errors 컬럼 고정). stack 에 싣는다.
            stack: [
                `slot=${slotId}`,
                `reserved=${Math.round(reserved)}`,
                `creative=${Math.round(creative)}`,
                `grewBy=${Math.round(grewBy)}`,
                `inViewport=${inViewport}`,
                `vw=${window.innerWidth}`,
                `path=${location.pathname.replace(/\/\d+/g, '/:id').slice(0, 60)}`
            ].join('\n'),
            url: location.href,
            userAgent: navigator.userAgent
        };
        const body = JSON.stringify(payload);
        if (typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon(
                AD_EXPAND_DANTRY_URL,
                new Blob([body], { type: 'application/json' })
            );
        }
    } catch {
        // 관측 실패는 무시 — 광고 렌더를 방해하면 안 된다
    }
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
                    // #12632: 확장은 layout shift 를 만든다. Chrome/FF 는 scroll anchoring 으로
                    // 시야를 자동 보정하지만 Safari 는 미지원이라, 확장 순간 누르려던 글 행이
                    // 아래로 밀리며 클릭 좌표가 광고를 때리는 오클릭이 발생(무효 클릭 = AdSense
                    // 정책 리스크). 2중 가드:
                    //  (a) 슬롯이 viewport 에 보이는 상태에서 실제로 늘어났으면 잠시(400ms)
                    //      광고 프레임의 pointer-events 를 차단 — 반사 클릭이 광고로 가지 않음
                    //  (b) 슬롯이 viewport 보다 위에 있으면 늘어난 만큼 scrollBy 보정
                    //      (Safari 수동 anchoring — 읽던 위치 유지)
                    const rectBefore = (frame ?? container).getBoundingClientRect();
                    let grewBy = 0;
                    // 관측용 — 어느 슬롯이 얼마나 모자라게 예약돼 있었는지 남긴다.
                    let reservedBefore = 0;
                    for (const el of [container, frame]) {
                        if (!el) continue;
                        const current = parseFloat(getComputedStyle(el).minHeight) || 0;
                        reservedBefore = Math.max(reservedBefore, current);
                        if (creativeHeight > current) {
                            el.style.minHeight = `${creativeHeight}px`;
                            grewBy = Math.max(grewBy, creativeHeight - current);
                        }
                    }
                    if (grewBy > 0 && frame) {
                        const inViewport =
                            rectBefore.bottom > 0 && rectBefore.top < window.innerHeight;
                        // ⛔ 예약이 모자란 순간을 그대로 기록한다. 이 값들이 있어야
                        //    예약 높이를 근거 있게 올릴 수 있다(지금은 코드에 고정값).
                        reportAdExpansion(
                            slotId,
                            reservedBefore,
                            creativeHeight,
                            grewBy,
                            inViewport
                        );
                        if (rectBefore.bottom <= 0) {
                            // (b) viewport 위에서 확장 → 보이는 콘텐츠가 밀리지 않게 보정
                            window.scrollBy(0, grewBy);
                        } else if (inViewport) {
                            // (a) 확장 직후 반사 클릭 차단
                            frame.style.pointerEvents = 'none';
                            window.setTimeout(() => {
                                frame.style.pointerEvents = '';
                            }, 400);
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

/**
 * bug/13656: 모바일에서 댓글 에디터(Tiptap contenteditable) 포커스 중, 인접 댓글 광고
 * 슬롯의 주기적 refresh 가 GAM iframe 을 교체하며 포커스된 편집 요소를 blur → Android
 * 소프트키보드가 하강한다. 기존 rAF 포커스 복원(아래)은 프로그램적 focus 라 모바일에서
 * 키보드를 다시 띄우지 못해 무력하다. 따라서 blur 를 원천 차단한다:
 * 편집 요소에 포커스가 있으면 댓글 영역 슬롯의 refresh 를 다음 주기로 미룬다.
 *
 * - 댓글 영역 슬롯(comment-infeed / board-after-comments)에만 적용 → 사이드바 등 무관
 *   슬롯은 기존대로 refresh(회귀 없음).
 * - 편집 요소에 포커스가 없으면 미루지 않음 → 일반 열람 중에는 정상 refresh.
 * - 연속 미룸 상한(MAX_FOCUS_DEFERS)에 도달하면 포커스와 무관하게 1회 refresh 를
 *   허용해 광고가 영구 미노출되지 않게 한다.
 */
const COMMENT_AREA_POSITIONS = new Set(['comment-infeed', 'board-after-comments']);
/** 연속으로 미룰 수 있는 최대 횟수 (interval 40~45s × 4 ≈ 최대 3분 억제 후 강제 refresh) */
const MAX_FOCUS_DEFERS = 4;

/** 현재 포커스가 편집 입력 요소(contenteditable / textarea / input)에 있는지 */
function isEditableElementFocused(): boolean {
    if (!browser) return false;
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'TEXTAREA' || tag === 'INPUT';
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

            // bug/13656: 댓글 영역 슬롯이고 편집 요소에 포커스가 있으면 refresh 를 미뤄
            // 소프트키보드 하강을 막는다. 연속 상한에 도달하면 강제 refresh 로 폴백.
            if (COMMENT_AREA_POSITIONS.has(state.position) && isEditableElementFocused()) {
                if (state.focusDeferCount < MAX_FOCUS_DEFERS) {
                    state.focusDeferCount += 1;
                    // viewable 은 아직 true → 다음 주기로 재예약
                    scheduleViewableRefresh(state, intervalMs);
                    return;
                }
                // 상한 도달 → 이번엔 포커스와 무관하게 refresh 진행(광고 영구 미노출 방지)
            }
            state.focusDeferCount = 0;

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
            fallbackTriggered: false,
            focusDeferCount: 0
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
