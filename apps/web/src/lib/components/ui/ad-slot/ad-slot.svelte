<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        position: string;
        height?: string;
        class?: string;
        sizes?: Array<[number, number]> | 'fluid';
    }

    let { position, height = '90px', class: className = '', sizes }: Props = $props();

    // GAM 설정 (www/theme/damoang/layout/basic/config/gam-slots.php 와 동일)
    const GAM_NETWORK_CODE = '23338387889';
    const GAM_AD_REFRESH_INTERVAL = 60; // 초
    const GAM_AD_EMPTY_RETRY_DELAY = 30; // 초

    let isLoaded = $state(false);
    let hasAd = $state(false);
    let slotId = $state('');
    let slot: googletag.Slot | null = null;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    // GPT 서비스 초기화 플래그 (전역)
    const GPT_INITIALIZED_KEY = '__gpt_services_initialized__';
    function isGptInitialized(): boolean {
        return browser && window[GPT_INITIALIZED_KEY] === true;
    }
    function markGptInitialized(): void {
        if (browser) {
            window[GPT_INITIALIZED_KEY] = true;
        }
    }

    // GAM 광고 단위 (www와 동일)
    const AD_UNIT_PATHS = {
        main: `/${GAM_NETWORK_CODE}/damoang/banner-responsive_main`,
        sub: `/${GAM_NETWORK_CODE}/damoang/banner-responsive_sub`,
        curation: `/${GAM_NETWORK_CODE}/damoang/banner-responsive_curation`,
        article: `/${GAM_NETWORK_CODE}/damoang/banner-responsive_article`
    };

    // 광고 유형별 설정 (www gam-slots.php 기반)
    type AdConfig = {
        unit: string;
        sizes: Array<[number, number]>;
        responsive: Array<[number, Array<[number, number]>]> | null;
    };

    const AD_CONFIGS: Record<string, AdConfig> = {
        // 메인 콘텐츠 영역 배너 (큰 배너) → main
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
        // 게시글 본문 영역 → article
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
        // 반응형 배너 → sub
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
        // 소형 배너 → sub
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
        // 사이드바 정사각 → sub
        'banner-square': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [[300, 250]],
            responsive: null
        },
        // 사이드바 수직형 → sub
        'banner-halfpage': {
            unit: AD_UNIT_PATHS.sub,
            sizes: [
                [300, 600],
                [300, 250]
            ],
            responsive: null
        },
        // 인피드 (목록 사이) → curation
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
        }
    };

    // 사이트 위치 → 광고 유형 매핑 (www position_map 기반)
    const POSITION_MAP: Record<string, string> = {
        'board-head': 'banner-horizontal',
        'board-list-head': 'banner-responsive',
        'board-list-bottom': 'banner-large',
        'board-content': 'banner-responsive',
        'board-content-bottom': 'banner-large',
        'board-footer': 'banner-horizontal',
        'index-head': 'banner-small',
        'index-top': 'banner-responsive',
        'index-news-economy': 'banner-responsive',
        'index-middle-1': 'banner-horizontal',
        'index-middle-2': 'banner-horizontal',
        'index-middle-3': 'banner-horizontal',
        'index-bottom': 'banner-large',
        'header-after': 'banner-horizontal',
        'comment-infeed': 'infeed',
        'comment-top': 'banner-compact',
        'sidebar-sticky': 'banner-halfpage',
        sidebar: 'banner-square'
    };

    // 위치별 기본 사이즈 매핑 (fallback)
    const DEFAULT_SIZES: Record<string, Array<[number, number]> | 'fluid'> = {
        'header-after': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'index-head': [
            [728, 90],
            [320, 100]
        ],
        'index-top': [
            [728, 90],
            [320, 100],
            [300, 250]
        ],
        'index-news-economy': [
            [728, 90],
            [320, 100],
            [300, 250]
        ],
        'index-middle-1': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'index-middle-2': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'index-middle-3': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'index-bottom': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'board-head': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'board-list-head': [
            [728, 90],
            [320, 100],
            [300, 250]
        ],
        'board-list-bottom': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'board-content': [
            [728, 90],
            [300, 250],
            [320, 100]
        ],
        'board-content-bottom': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'board-footer': [
            [728, 90],
            [970, 90],
            [320, 100]
        ],
        'comment-infeed': [
            [728, 90],
            [300, 250],
            [320, 100]
        ],
        'comment-top': [
            [728, 90],
            [320, 100]
        ],
        'sidebar-sticky': [
            [300, 250],
            [300, 600]
        ],
        sidebar: [[300, 250]]
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
        'board-head': '게시판 상단',
        'board-list-head': '목록 상단',
        'board-list-bottom': '목록 하단',
        'board-content': '본문 광고',
        'board-content-bottom': '본문 하단',
        'board-footer': '게시판 하단',
        'comment-infeed': '댓글 인피드',
        'sidebar-sticky': '사이드바 고정'
    };

    // GPT 스크립트 로드
    function loadGPT(): Promise<void> {
        return new Promise((resolve) => {
            if (!browser) return resolve();

            // 이미 로드됨
            if (window.googletag?.apiReady) {
                resolve();
                return;
            }

            const existingScript = document.querySelector(
                'script[src*="securepubads.g.doubleclick.net"]'
            );
            if (existingScript) {
                // 스크립트가 있지만 아직 로드 안됨
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
    function getAdConfig(): {
        unit: string;
        sizes: Array<[number, number]>;
        responsive: Array<[number, Array<[number, number]>]> | null;
    } {
        const configKey = POSITION_MAP[position];
        if (configKey && AD_CONFIGS[configKey]) {
            return AD_CONFIGS[configKey];
        }
        // Fallback: 기본 설정
        return {
            unit: AD_UNIT_PATHS.sub,
            sizes: (sizes as Array<[number, number]>) ||
                (DEFAULT_SIZES[position] as Array<[number, number]>) || [
                    [728, 90],
                    [320, 100]
                ],
            responsive: [
                [728, [[728, 90]]],
                [0, [[320, 100]]]
            ]
        };
    }

    // 광고 슬롯 정의 및 표시
    async function initAdSlot() {
        if (!browser) return;

        await loadGPT();

        const config = getAdConfig();
        const adUnitPath = config.unit;
        const adSizes = sizes || config.sizes;
        slotId = `gam-${position}-${Math.random().toString(36).substr(2, 9)}`;

        window.googletag = window.googletag || { cmd: [] };

        googletag.cmd.push(() => {
            const divId = slotId;

            // 슬롯 정의
            if (adSizes === 'fluid') {
                slot = googletag.defineSlot(adUnitPath, ['fluid'], divId);
            } else {
                slot = googletag.defineSlot(adUnitPath, adSizes as googletag.GeneralSize, divId);
            }

            if (slot) {
                // 반응형 사이즈 매핑 적용
                if (config.responsive) {
                    const mapping = googletag.sizeMapping();
                    for (const [viewport, slotSizes] of config.responsive) {
                        mapping.addSize([viewport, 0], slotSizes as googletag.GeneralSize);
                    }
                    const builtMapping = mapping.build();
                    if (builtMapping) {
                        slot.defineSizeMapping(builtMapping);
                    }
                }

                slot.addService(googletag.pubads());

                // 빈 광고 이벤트 처리
                googletag
                    .pubads()
                    .addEventListener(
                        'slotRenderEnded',
                        (event: googletag.events.SlotRenderEndedEvent) => {
                            if (event.slot === slot) {
                                isLoaded = true;
                                hasAd = !event.isEmpty;

                                // 빈 광고면 재시도
                                if (event.isEmpty) {
                                    setTimeout(() => {
                                        if (slot) {
                                            googletag.pubads().refresh([slot]);
                                        }
                                    }, GAM_AD_EMPTY_RETRY_DELAY * 1000);
                                }
                            }
                        }
                    );

                // GPT 서비스 초기화 (한 번만 실행)
                if (!isGptInitialized()) {
                    googletag.pubads().disableInitialLoad();
                    googletag.pubads().enableSingleRequest();
                    googletag.enableServices();
                    markGptInitialized();
                }

                // 광고 표시
                googletag.display(divId);
                googletag.pubads().refresh([slot]);

                // 자동 새로고침 설정
                refreshInterval = setInterval(() => {
                    if (slot && hasAd) {
                        googletag.pubads().refresh([slot]);
                    }
                }, GAM_AD_REFRESH_INTERVAL * 1000);
            }
        });
    }

    onMount(() => {
        initAdSlot();
    });

    onDestroy(() => {
        // 새로고침 인터벌 정리
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }

        // 슬롯 정리
        if (slot && browser && window.googletag) {
            googletag.cmd.push(() => {
                if (slot) {
                    googletag.destroySlots([slot]);
                }
            });
        }
    });
</script>

<div
    class="ad-slot-container relative overflow-hidden rounded-lg transition-all duration-300 {className}"
    class:ad-slot-placeholder={!isLoaded}
    class:ad-slot-loaded={isLoaded && hasAd}
    style:min-height={height}
>
    {#if slotId}
        <!-- GAM 광고 슬롯 -->
        <div id={slotId} class="gam-ad-slot w-full" style="min-height: {height};"></div>
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
    {:else if !hasAd}
        <!-- 광고 없음 플레이스홀더 -->
        <div
            class="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-900/20"
        >
            <div class="flex flex-col items-center gap-1.5 text-center">
                <span class="text-xs font-semibold text-amber-600 dark:text-amber-400">AD</span>
                <span class="text-[10px] text-amber-500 dark:text-amber-500">
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

    .gam-ad-slot {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .gam-ad-slot:empty {
        display: none;
    }
</style>
