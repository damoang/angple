<script lang="ts">
    import '../../app.css';
    import { onMount } from 'svelte';
    import Header from '$lib/components/layout/header.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import Panel from '$lib/components/layout/panel.svelte';
    import Footer from '$lib/components/layout/footer.svelte';
    import LeftBanner from '$lib/components/layout/left-banner.svelte';
    import RightBanner from '$lib/components/layout/right-banner.svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import { page } from '$app/stores';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';

    /**
     * 기본 레이아웃 컴포넌트
     * 테마가 활성화되지 않았을 때 사용되는 fallback 레이아웃
     */

    const { children } = $props(); // Svelte 5
    let snbPosition = $state<'left' | 'right'>('left'); // 기본값

    // 풀폭 페이지 = 사이드바 숨김. 라우트 load 의 { fullWidth: true } 플래그(재사용 가능)
    // 또는 경로 prefix(/brickang)로 감지. 플래그/경로 미해당이면 항상 false → 다른 페이지 영향 0.
    const fullWidthPaths = ['/brickang'];
    const fullWidth = $derived(
        $page.data?.fullWidth === true ||
            fullWidthPaths.some(
                (p) => $page.url.pathname === p || $page.url.pathname.startsWith(p + '/')
            )
    );

    onMount(() => {
        // 인증 상태 초기화
        authActions.initAuth();
    });
</script>

<div class="relative flex min-h-screen flex-col items-center">
    <!-- 배경 박스 -->
    {#if snbPosition === 'left'}
        <div class="snb-backdrop-left"></div>
    {:else if snbPosition === 'right'}
        <div class="snb-backdrop-right"></div>
    {/if}

    <div class="container relative z-10 flex w-full flex-1 flex-col">
        <Header />

        <div class="mx-auto flex w-full flex-1">
            {#if snbPosition === 'right'}
                <aside
                    class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:flex lg:flex-col"
                >
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
            {#if snbPosition === 'left'}
                <aside class="bg-background hidden 2xl:block 2xl:!w-[230px]">
                    <Sidebar />
                </aside>
            {/if}

            <!--
                ⛔ **본문 컬럼의 폭을 미리 확정한다.** `flex-1` 만 두면 브라우저가
                   사이드바를 파싱하기 전에 본문을 **전체 폭으로 배치·페인트**하고,
                   뒤늦게 사이드바를 만나 320px 좁힌다 — 그때 아래가 통째로 밀린다.

                   2026-08-20 실측(CPU 4배 스로틀, 실사용자 조건):
                     t= 731ms  aside 없음        main 1,162px
                     t=1072ms  aside 320px 등장  main   842px   → CLS 0.107

                   운영 HTML 에서 Panel 은 main 보다 **97KB 뒤**에 온다(main 165,382 /
                   Panel 262,510). 그 간격이 느린 CPU 에서 밀림으로 드러난다.
                   빠른 머신은 첫 페인트 전에 파싱이 끝나 안 보인다 — 프로브 0.0038 vs
                   실사용자 p75 0.099 의 26배 간극이 이것이었다.

                ⭐ 폭을 명시하면 사이드바가 아직 없어도 본문 폭이 안 바뀐다.
                   DOM 순서·탭 순서·시각 배치는 그대로다(grid 리팩터나 order 뒤집기 불필요).
                ⛔ fullWidth 페이지는 Panel 을 안 그리므로 폭을 빼면 안 된다 —
                   조건을 Panel 렌더 조건과 **같은 식**으로 묶는다.
                ⛔ `width` 가 아니라 **`max-width`** 다. 폭을 고정하면 사이드바 구성이
                   다른 페이지에서 넘치거나 빈칸이 생긴다. 상한만 걸면 본문은 여전히
                   줄어들 수 있고, **넓어지는 것만** 막는다 — 밀림의 원인은 그쪽이다.
                   숫자: Panel 320px, 2xl 에서 Sidebar 230px 추가 → 550px.
                   ⚠️ Sidebar 는 main **앞**에 있어 먼저 파싱되므로 밀림을 안 만든다.
                      상한 계산에는 포함해야 넘치지 않는다.
            -->
            <div
                class="flex min-w-0 flex-1 flex-col {fullWidth
                    ? ''
                    : 'lg:max-w-[calc(100%-320px)] 2xl:max-w-[calc(100%-550px)]'}"
            >
                {#if widgetLayoutStore.hasEnabledAds && $page.url.pathname !== '/'}
                    <div class="hidden w-full px-5 pt-4 md:px-0 lg:block">
                        <AdSlot position="header-after" height="90px" slotKey="header-after" />
                    </div>
                {/if}
                <main
                    class="flex-0 box-content min-w-0 px-0 pt-0 md:px-0 md:py-3 [&_[data-slot='card']]:mx-0"
                >
                    {@render children()}
                </main>
            </div>
            {#if snbPosition === 'right' && !fullWidth}
                <aside class="bg-background hidden 2xl:block 2xl:!w-[230px]">
                    <Sidebar />
                </aside>
            {/if}

            {#if snbPosition === 'left' && !fullWidth}
                <aside
                    class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:flex lg:flex-col"
                >
                    <!-- 여기에 오른쪽 사이드바 내용 추가 -->
                    <Panel />
                </aside>
            {/if}
        </div>
    </div>
    <!-- 왼쪽 윙 배너 - 1600px 이상에서 다시 노출 -->
    <aside class="top-21 fixed hidden min-[1600px]:block" style="right: calc(50% + 640px);">
        <LeftBanner />
    </aside>
    <!-- 오른쪽 윙 배너 - 1600px 이상에서 다시 노출 -->
    <aside class="top-21 fixed hidden min-[1600px]:block" style="left: calc(50% + 640px);">
        <RightBanner />
    </aside>

    <!-- 푸터 -->
    <Footer />
</div>
