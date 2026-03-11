<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import { browser } from '$app/environment';
    import {
        GAM_SITE_NAME,
        GAM_AD_REFRESH_INTERVAL,
        GAM_AD_EMPTY_RETRY_DELAY,
        AD_UNIT_PATHS,
        AD_CONFIGS,
        POSITION_MAP,
        POSITION_LABELS,
        type AdConfig
    } from '$lib/config/ad-config.js';

    interface Props {
        position: string;
        height?: string;
        class?: string;
        sizes?: Array<[number, number]> | 'fluid';
    }

    let { position, height = '90px', class: className = '', sizes }: Props = $props();

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let slotId = $state('');
    let computedHeight = $state(height);
    let slot: googletag.Slot | null = null;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    let emptyRetryTimeout: ReturnType<typeof setTimeout> | null = null;
    let emptyRetryCount = 0;
    let destroyed = false;
    let isVisible = false;
    let visibilityObserver: IntersectionObserver | null = null;
    let containerEl: HTMLDivElement | null = null;

    // ========================================
    // 배치 슬롯 매니저 (전역 싱글톤)
    // ========================================
    const BATCH_KEY = '__gam_batch_manager__';

    interface BatchManager {
        queue: Array<{
            divId: string;
            config: AdConfig;
            adSizes: Array<[number, number]> | 'fluid';
            onRender: (isEmpty: boolean) => void;
        }>;
        timer: ReturnType<typeof setTimeout> | null;
        servicesEnabled: boolean;
        slotsMap: Map<string, googletag.Slot>;
        renderCallbacks: Map<string, (isEmpty: boolean) => void>;
        slotRenderListenerRegistered: boolean;
    }

    function getBatchManager(): BatchManager {
        if (!browser)
            return {
                queue: [],
                timer: null,
                servicesEnabled: false,
                slotsMap: new Map(),
                renderCallbacks: new Map(),
                slotRenderListenerRegistered: false
            };
        if (!(window as any)[BATCH_KEY]) {
            (window as any)[BATCH_KEY] = {
                queue: [],
                timer: null,
                servicesEnabled: false,
                slotsMap: new Map(),
                renderCallbacks: new Map(),
                slotRenderListenerRegistered: false
            };
        }
        return (window as any)[BATCH_KEY];
    }

    function processBatch() {
        const mgr = getBatchManager();
        if (mgr.queue.length === 0) return;

        const batch = mgr.queue.splice(0);

        googletag.cmd.push(() => {
            const newSlots: googletag.Slot[] = [];

            if (!mgr.slotRenderListenerRegistered) {
                googletag
                    .pubads()
                    .addEventListener(
                        'slotRenderEnded',
                        (event: googletag.events.SlotRenderEndedEvent) => {
                            const divId = event.slot.getSlotElementId();
                            const onRender = mgr.renderCallbacks.get(divId);
                            if (onRender) {
                                onRender(event.isEmpty);
                            }
                        }
                    );
                mgr.slotRenderListenerRegistered = true;
            }

            for (const item of batch) {
                if (!document.getElementById(item.divId)) continue;
                if (mgr.slotsMap.has(item.divId)) continue;

                let s: googletag.Slot | null;
                if (item.adSizes === 'fluid') {
                    s = googletag.defineSlot(item.config.unit, ['fluid'], item.divId);
                } else {
                    s = googletag.defineSlot(
                        item.config.unit,
                        item.adSizes as googletag.GeneralSize,
                        item.divId
                    );
                }

                if (!s) continue;

                if (item.config.responsive) {
                    const mapping = googletag.sizeMapping();
                    for (const [viewport, slotSizes] of item.config.responsive) {
                        mapping.addSize([viewport, 0], slotSizes as googletag.GeneralSize);
                    }
                    const builtMapping = mapping.build();
                    if (builtMapping) {
                        s.defineSizeMapping(builtMapping);
                    }
                }

                s.addService(googletag.pubads());
                mgr.slotsMap.set(item.divId, s);
                mgr.renderCallbacks.set(item.divId, item.onRender);
                newSlots.push(s);
            }

            if (!mgr.servicesEnabled) {
                googletag.pubads().collapseEmptyDivs();
                googletag.pubads().enableLazyLoad({
                    fetchMarginPercent: 200,
                    renderMarginPercent: 100,
                    mobileScaling: 2.0
                });
                googletag.pubads().setCentering(true);
                googletag.pubads().setTargeting('site', GAM_SITE_NAME);
                const theme = document.documentElement.classList.contains('dark')
                    ? 'dark'
                    : 'light';
                googletag.pubads().setTargeting('theme', theme);
                googletag.enableServices();
                mgr.servicesEnabled = true;
            }

            // display 호출로 초기 광고 요청이 시작됨
            for (const s of newSlots) {
                googletag.display(s.getSlotElementId());
            }
        });
    }

    function enqueueSlot(
        divId: string,
        config: AdConfig,
        adSizes: Array<[number, number]> | 'fluid',
        onRender: (isEmpty: boolean) => void
    ) {
        const mgr = getBatchManager();
        mgr.queue.push({ divId, config, adSizes, onRender });

        // 50ms 디바운스로 같은 틱에 마운트되는 슬롯들을 배치 처리
        if (mgr.timer) clearTimeout(mgr.timer);
        mgr.timer = setTimeout(() => {
            mgr.timer = null;
            processBatch();
        }, 50);
    }

    // GPT 스크립트 로드
    function loadGPT(): Promise<void> {
        return new Promise((resolve) => {
            if (!browser) return resolve();

            if (window.googletag?.apiReady) {
                resolve();
                return;
            }

            const existingScript = document.querySelector(
                'script[src*="securepubads.g.doubleclick.net"]'
            );
            if (existingScript) {
                const checkReady = setInterval(() => {
                    if (window.googletag?.apiReady) {
                        clearInterval(checkReady);
                        resolve();
                    }
                }, 100);
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
            script.async = true;
            script.onload = () => {
                const checkReady = setInterval(() => {
                    if (window.googletag?.apiReady) {
                        clearInterval(checkReady);
                        resolve();
                    }
                }, 100);
            };
            document.head.appendChild(script);
        });
    }

    // 광고 설정 가져오기
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

    // 반응형 높이 자동 계산
    function getResponsiveHeight(config: AdConfig): string {
        if (typeof window === 'undefined') return height;
        const width = window.innerWidth;
        if (config.responsive) {
            for (const [viewport, viewportSizes] of config.responsive) {
                if (width >= viewport && viewportSizes.length > 0) {
                    const maxHeight = Math.max(...viewportSizes.map((s) => s[1]));
                    return `${maxHeight}px`;
                }
            }
        }
        // fallback: 기본 sizes에서 최대 높이
        if (config.sizes.length > 0) {
            const maxHeight = Math.max(...config.sizes.map((s) => s[1]));
            return `${maxHeight}px`;
        }
        return height;
    }

    // 광고 슬롯 초기화
    async function initAdSlot() {
        if (!browser) return;

        await loadGPT();

        const config = getAdConfig();
        const adSizes = sizes || config.sizes;
        slotId = `gam-${position}-${Math.random().toString(36).substr(2, 9)}`;

        // 반응형 높이 자동 계산 (CLS 방지)
        computedHeight = getResponsiveHeight(config);

        await tick();

        window.googletag = window.googletag || { cmd: [] };

        // IntersectionObserver로 viewability 추적
        const slotEl = document.getElementById(slotId);
        if (slotEl) {
            visibilityObserver = new IntersectionObserver(
                ([entry]) => {
                    isVisible = entry.isIntersecting;
                },
                { threshold: 0.5 }
            );
            visibilityObserver.observe(slotEl);
        }

        enqueueSlot(slotId, config, adSizes, (isEmpty: boolean) => {
            isLoaded = true;
            hasAd = !isEmpty;

            // 슬롯 참조 저장
            const mgr = getBatchManager();
            slot = mgr.slotsMap.get(slotId) || null;
            const maxRetryLimit = 3;
            // 빈 광고면 delay ms 마다 최대 3회까지만 재시도하고, 중복 타이머는 만들지 않음
            if (!isEmpty) {
                if (emptyRetryTimeout) {
                    clearTimeout(emptyRetryTimeout);
                    emptyRetryTimeout = null;
                }
            } else if (slot && emptyRetryCount < maxRetryLimit && !emptyRetryTimeout) {
                const delayMilliseconds =
                    emptyRetryCount === 0 ? 10_000 : GAM_AD_EMPTY_RETRY_DELAY * 1000;
                emptyRetryTimeout = setTimeout(() => {
                    emptyRetryTimeout = null;
                    if (slot && !destroyed && hasAd === false) {
                        emptyRetryCount += 1;
                        googletag.cmd.push(() => {
                            if (slot && !destroyed) {
                                googletag.pubads().refresh([slot], { changeCorrelator: false });
                            }
                        });
                    }
                }, delayMilliseconds);
            }

            // 자동 새로고침 설정 (viewability 체크)
            if (!isEmpty && !refreshInterval) {
                refreshInterval = setInterval(() => {
                    if (slot && hasAd && !destroyed && isVisible) {
                        googletag.pubads().refresh([slot], { changeCorrelator: false });
                    }
                }, GAM_AD_REFRESH_INTERVAL * 1000);
            }
        });
    }

    onMount(() => {
        initAdSlot();
    });

    onDestroy(() => {
        destroyed = true;

        if (visibilityObserver) {
            visibilityObserver.disconnect();
        }

        if (refreshInterval) {
            clearInterval(refreshInterval);
        }

        if (emptyRetryTimeout) {
            clearTimeout(emptyRetryTimeout);
        }

        if (slot && browser && window.googletag) {
            googletag.cmd.push(() => {
                if (slot) {
                    googletag.destroySlots([slot]);
                    const mgr = getBatchManager();
                    mgr.slotsMap.delete(slotId);
                    mgr.renderCallbacks.delete(slotId);
                }
            });
        }
    });
</script>

<div
    bind:this={containerEl}
    class="ad-slot-container relative overflow-hidden rounded-lg transition-all duration-300 {className}"
    class:ad-slot-placeholder={!isLoaded}
    class:ad-slot-loaded={isLoaded && hasAd}
    style:min-height={computedHeight}
>
    {#if slotId}
        <!-- GAM 광고 슬롯 -->
        <div id={slotId} class="gam-ad-slot w-full" style="min-height: {computedHeight};"></div>
    {/if}

    {#if !isLoaded}
        <!-- 로딩 중 플레이스홀더 -->
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
