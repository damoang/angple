<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        position: string;
        height?: string;
        class?: string;
        sizes?: Array<[number, number]> | 'fluid';
    }

    let { position, height = '90px', class: className = '', sizes }: Props = $props();

    // GAM 설정 (환경변수 기반)
    const GAM_NETWORK_CODE = import.meta.env.VITE_GAM_NETWORK_CODE || '';
    const GAM_SITE_NAME = import.meta.env.VITE_GAM_SITE_NAME || 'default';
    const GAM_AD_REFRESH_INTERVAL = 60; // 초
    const GAM_AD_EMPTY_RETRY_DELAY = 30; // 초

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let slotId = $state('');
    let computedHeight = $state(height);
    let slot: googletag.Slot | null = null;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    let destroyed = false;
    let isVisible = false;
    let visibilityObserver: IntersectionObserver | null = null;
    let containerEl: HTMLDivElement | null = null;

    // GAM 광고 단위 (환경변수 기반)
    const AD_UNIT_PATHS: Record<string, string> = {
        main: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/banner-responsive_main`,
        sub: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/banner-responsive_sub`,
        curation: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/banner-responsive_curation`,
        article: `/${GAM_NETWORK_CODE}/${GAM_SITE_NAME}/banner-responsive_article`
    };

    // 광고 유형별 설정
    type AdConfig = {
        unit: string;
        sizes: Array<[number, number]>;
        responsive: Array<[number, Array<[number, number]>]> | null;
    };

    const AD_CONFIGS: Record<string, AdConfig> = {
        'banner-horizontal': {
            unit: AD_UNIT_PATHS.main,
            sizes: [
                [970, 250],
                [970, 90],
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [
                    970,
                    [
                        [970, 250],
                        [970, 90],
                        [728, 90]
                    ]
                ],
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        'banner-large': {
            unit: AD_UNIT_PATHS.main,
            sizes: [
                [970, 250],
                [970, 90],
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [
                    970,
                    [
                        [970, 250],
                        [970, 90]
                    ]
                ],
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        'banner-view-content': {
            unit: AD_UNIT_PATHS.article,
            sizes: [
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        'banner-responsive': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        'banner-small': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [
                [728, 90],
                [320, 100]
            ],
            responsive: [
                [728, [[728, 90]]],
                [0, [[320, 100]]]
            ]
        },
        'banner-compact': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [
                [728, 90],
                [320, 100]
            ],
            responsive: [
                [728, [[728, 90]]],
                [0, [[320, 100]]]
            ]
        },
        'banner-square': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [[300, 250]],
            responsive: null
        },
        'banner-halfpage': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [
                [300, 600],
                [300, 250]
            ],
            responsive: null
        },
        'banner-medium': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        'banner-medium-compact': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [
                [728, 90],
                [320, 100]
            ],
            responsive: [
                [728, [[728, 90]]],
                [0, [[320, 100]]]
            ]
        },
        'banner-large-compact': {
            unit: AD_UNIT_PATHS.main,
            sizes: [
                [970, 250],
                [970, 90],
                [728, 90],
                [320, 100]
            ],
            responsive: [
                [
                    970,
                    [
                        [970, 250],
                        [970, 90]
                    ]
                ],
                [728, [[728, 90]]],
                [0, [[320, 100]]]
            ]
        },
        'banner-large-728': {
            unit: AD_UNIT_PATHS.main,
            sizes: [
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        'banner-horizontal-728': {
            unit: AD_UNIT_PATHS.article,
            sizes: [
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        infeed: {
            unit: AD_UNIT_PATHS.curation,
            sizes: [
                [728, 90],
                [320, 100],
                [300, 250]
            ],
            responsive: [
                [728, [[728, 90]]],
                [
                    0,
                    [
                        [320, 100],
                        [300, 250]
                    ]
                ]
            ]
        },
        'infeed-compact': {
            unit: AD_UNIT_PATHS.curation,
            sizes: [
                [728, 90],
                [320, 100]
            ],
            responsive: [
                [728, [[728, 90]]],
                [0, [[320, 100]]]
            ]
        },
        'banner-vertical': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [[160, 600]],
            responsive: null
        }
    };

    // 사이트 위치 → 광고 유형 매핑
    const POSITION_MAP: Record<string, string> = {
        'board-view-top': 'banner-small',
        'board-head': 'banner-horizontal',
        'board-list-head': 'banner-medium-compact',
        'board-list-bottom': 'banner-large-compact',
        'board-content': 'banner-small',
        'board-content-bottom': 'banner-large',
        'board-before-comments': 'banner-small',
        'board-after-comments': 'banner-compact',
        'board-footer': 'banner-compact',
        'index-head': 'banner-small',
        'index-top': 'banner-responsive',
        'index-news-economy': 'banner-responsive',
        'index-middle-1': 'banner-horizontal',
        'index-middle-2': 'banner-horizontal',
        'index-middle-3': 'banner-horizontal',
        'index-bottom': 'banner-large',
        'header-after': 'banner-horizontal',
        'board-list-infeed': 'infeed-compact',
        'comment-infeed': 'infeed-compact',
        'comment-top': 'banner-compact',
        'sidebar-sticky': 'banner-halfpage',
        sidebar: 'banner-square',
        'sidebar-1': 'banner-square',
        'sidebar-2': 'banner-square',
        'sidebar-b2b': 'banner-square',
        'wing-left': 'banner-vertical',
        'wing-right': 'banner-vertical'
    };

    // 위치별 라벨 매핑
    const positionLabels: Record<string, string> = {
        'header-after': '메뉴 하단',
        'index-head': '상단 광고',
        'index-top': '추천글 하단 광고',
        'index-news-economy': '소식/구매 사이',
        'index-middle-1': '중간 광고 1',
        'index-middle-2': '중간 광고 2',
        'index-middle-3': '중간 광고 3',
        'index-bottom': '하단 광고',
        'side-banner': '사이드 배너',
        'board-view-top': '본문 상단',
        'board-head': '게시판 상단',
        'board-list-head': '목록 상단',
        'board-list-bottom': '목록 하단',
        'board-content': '본문 광고',
        'board-content-bottom': '본문 하단',
        'board-before-comments': '댓글 상단',
        'board-after-comments': '댓글 하단',
        'board-footer': '게시판 하단',
        'board-list-infeed': '목록 인피드',
        'comment-infeed': '댓글 인피드',
        'sidebar-sticky': '사이드바 고정',
        'sidebar-2': 'sidebar-2',
        'sidebar-b2b': 'B2B 광고',
        'wing-left': '왼쪽 윙 배너',
        'wing-right': '오른쪽 윙 배너'
    };

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
    }

    function getBatchManager(): BatchManager {
        if (!browser)
            return { queue: [], timer: null, servicesEnabled: false, slotsMap: new Map() };
        if (!(window as any)[BATCH_KEY]) {
            (window as any)[BATCH_KEY] = {
                queue: [],
                timer: null,
                servicesEnabled: false,
                slotsMap: new Map()
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

            for (const item of batch) {
                if (!document.getElementById(item.divId)) continue;

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
                newSlots.push(s);

                // 개별 렌더 이벤트 콜백 등록
                const divId = item.divId;
                const onRender = item.onRender;
                googletag
                    .pubads()
                    .addEventListener(
                        'slotRenderEnded',
                        (event: googletag.events.SlotRenderEndedEvent) => {
                            if (event.slot.getSlotElementId() === divId) {
                                onRender(event.isEmpty);
                            }
                        }
                    );
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

            // display + refresh
            for (const s of newSlots) {
                googletag.display(s.getSlotElementId());
            }
            googletag.pubads().refresh(newSlots);
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

            // 빈 광고면 재시도
            if (isEmpty && slot) {
                setTimeout(() => {
                    if (slot && !destroyed) {
                        googletag.pubads().refresh([slot], { changeCorrelator: false });
                    }
                }, GAM_AD_EMPTY_RETRY_DELAY * 1000);
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

        if (slot && browser && window.googletag) {
            googletag.cmd.push(() => {
                if (slot) {
                    googletag.destroySlots([slot]);
                    const mgr = getBatchManager();
                    mgr.slotsMap.delete(slotId);
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
                    {positionLabels[position] || position}
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
