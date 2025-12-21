<script lang="ts">
    import { onMount, tick } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import X from '@lucide/svelte/icons/x';
    import Maximize2 from '@lucide/svelte/icons/maximize-2';
    import Minimize2 from '@lucide/svelte/icons/minimize-2';
    import Youtube from '@lucide/svelte/icons/youtube';

    // 팟캐스트 설정
    const VIDEO_ID = 'n4e7KiiLsog';
    const CHANNEL_URL = 'https://www.youtube.com/@DAMOANG_%EB%8B%A4%EB%AA%A8%EC%95%99';
    const SIDEBAR_ANCHOR_ID = 'podcast-sidebar-anchor';

    let isVisible = $state(true);
    let isMiniMode = $state(false);
    let isAnchorInView = $state(false);
    let hasStartedPlaying = $state(false);

    let playerWrapper: HTMLDivElement;
    let previousPath = $state('');

    // 앵커가 보이고 미니모드가 아닐 때 확장 모드
    let isExpandedMode = $derived(isAnchorInView && !isMiniMode);
    // 미니 플레이어 표시 조건
    let showMiniPlayer = $derived(isVisible && hasStartedPlaying && !isExpandedMode);

    // 페이지 변경 감지
    $effect(() => {
        if (browser) {
            const unsubscribe = page.subscribe((p) => {
                const newPath = p.url.pathname;
                if (previousPath && previousPath !== newPath && hasStartedPlaying) {
                    isMiniMode = true;
                }
                previousPath = newPath;
            });
            return unsubscribe;
        }
    });

    // 플레이어 위치 업데이트
    $effect(() => {
        if (!browser || !playerWrapper) return;

        const anchor = document.getElementById(SIDEBAR_ANCHOR_ID);

        if (isExpandedMode && anchor) {
            // 사이드바 앵커로 이동
            anchor.innerHTML = '';
            anchor.appendChild(playerWrapper);
        }
    });

    onMount(() => {
        if (!browser) return;

        let observer: IntersectionObserver | null = null;

        const setupObserver = async () => {
            await tick();

            const anchor = document.getElementById(SIDEBAR_ANCHOR_ID);
            if (!anchor) {
                isAnchorInView = false;
                return;
            }

            observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        isAnchorInView = entry.isIntersecting;
                    });
                },
                { threshold: 0.1, rootMargin: '50px' }
            );

            observer.observe(anchor);
        };

        setupObserver();

        const unsubscribe = page.subscribe(() => {
            setTimeout(setupObserver, 200);
        });

        return () => {
            observer?.disconnect();
            unsubscribe();
        };
    });

    function handleClose() {
        isVisible = false;
    }

    function handleExpand() {
        const anchor = document.getElementById(SIDEBAR_ANCHOR_ID);
        if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                isMiniMode = false;
            }, 300);
        } else {
            // 앵커가 없으면 홈으로 이동
            window.location.href = '/';
        }
    }

    function handleMinimize() {
        isMiniMode = true;
    }

    function handleReopen() {
        isVisible = true;
    }

    function onIframeClick() {
        hasStartedPlaying = true;
    }
</script>

<!-- 플레이어 래퍼 (이동 가능한 단일 인스턴스) -->
<div
    bind:this={playerWrapper}
    class="podcast-player-wrapper"
    class:mini-mode={showMiniPlayer}
    class:expanded-mode={isExpandedMode}
    onclick={onIframeClick}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && onIframeClick()}
>
    <!-- 확장 모드 헤더 -->
    {#if isExpandedMode}
        <div class="mb-3 flex items-center justify-between">
            <h3
                class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
                <Youtube class="h-4 w-4 text-red-500" />
                다모앙 팟캐스트
            </h3>
            {#if hasStartedPlaying}
                <button
                    onclick={handleMinimize}
                    class="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
                    aria-label="미니 플레이어로"
                    title="미니 플레이어로 전환"
                >
                    <Minimize2 class="h-4 w-4" />
                </button>
            {/if}
        </div>
    {/if}

    <!-- YouTube iframe -->
    <div
        class="aspect-video w-full overflow-hidden rounded-lg bg-slate-900"
        class:mini-iframe={showMiniPlayer}
    >
        <iframe
            class="h-full w-full"
            src="https://www.youtube.com/embed/{VIDEO_ID}?enablejsapi=1&rel=0"
            title="다모앙 팟캐스트"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
        ></iframe>
    </div>

    <!-- 확장 모드 채널 링크 -->
    {#if isExpandedMode}
        <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-2 flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-red-500 dark:text-slate-400"
        >
            <span>채널 바로가기</span>
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
            </svg>
        </a>
    {/if}
</div>

<!-- 미니 플레이어 컨테이너 (하단 고정) -->
{#if showMiniPlayer}
    <div
        class="fixed bottom-0 left-0 right-0 z-[60] border-t border-slate-200 bg-white/95 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95"
    >
        <div class="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
            <!-- 플레이어가 여기로 이동됨 (CSS로 위치 조정) -->
            <div
                id="mini-player-slot"
                class="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded"
            >
                <!-- playerWrapper가 여기에 위치 -->
            </div>

            <!-- 제목 -->
            <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    다모앙 팟캐스트
                </p>
                <a
                    href={CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 dark:text-slate-400"
                >
                    <Youtube class="h-3 w-3" />
                    <span>채널 바로가기</span>
                </a>
            </div>

            <!-- 컨트롤 버튼 -->
            <div class="flex items-center gap-1">
                <button
                    onclick={handleExpand}
                    class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-label="확장"
                    title="사이드바에서 보기"
                >
                    <Maximize2 class="h-4 w-4" />
                </button>
                <button
                    onclick={handleClose}
                    class="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30"
                    aria-label="닫기"
                    title="플레이어 닫기"
                >
                    <X class="h-4 w-4" />
                </button>
            </div>
        </div>
    </div>

    <!-- 미니 플레이어 높이만큼 하단 여백 -->
    <div class="h-16"></div>
{/if}

<!-- 플레이어 닫혔을 때 복구 버튼 -->
{#if !isVisible && hasStartedPlaying}
    <button
        onclick={handleReopen}
        class="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 hover:bg-red-700"
        aria-label="팟캐스트 다시 열기"
    >
        <Youtube class="h-4 w-4" />
        <span>팟캐스트</span>
    </button>
{/if}

<style>
    .podcast-player-wrapper {
        transition: all 0.3s ease;
    }

    .podcast-player-wrapper.mini-mode {
        position: fixed;
        bottom: 8px;
        left: 16px;
        width: 80px;
        height: 48px;
        z-index: 61;
        border-radius: 4px;
        overflow: hidden;
    }

    .podcast-player-wrapper.mini-mode .mini-iframe {
        aspect-ratio: auto;
        height: 100%;
    }

    .podcast-player-wrapper.expanded-mode {
        position: relative;
        width: 100%;
    }
</style>
