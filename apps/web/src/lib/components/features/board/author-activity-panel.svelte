<script lang="ts">
    import { onMount, tick } from 'svelte';
    import { browser } from '$app/environment';
    import type { FreePost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ChevronUp from '@lucide/svelte/icons/chevron-up';
    import { formatDate } from '$lib/utils/format-date.js';
    import {
        getPostLabel,
        getCommentLabel,
        type ContentKind,
        type ContentLabel
    } from '$lib/utils/content-label.js';
    import { slide } from 'svelte/transition';

    interface RecentPost {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        wr_subject: string;
        wr_datetime: string;
        href: string;
        deleted_at?: string | null;
    }

    interface RecentComment {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        parent_wr_id: number;
        preview: string;
        wr_datetime: string;
        href: string;
        deleted_at?: string | null;
        post_deleted_at?: string | null;
        /** 백엔드가 내려주는 콘텐츠 종류 — 미배포 시 undefined 라 유틸이 폴백한다 */
        content_kind?: ContentKind | null;
    }

    interface Props {
        post: FreePost;
        /** SSR 스트리밍으로 미리 받은 작성자 활동 (있으면 클릭 없이 즉시 표시, 클라 API fetch 생략) */
        initialActivity?: { recentPosts: RecentPost[]; recentComments: RecentComment[] } | null;
    }

    let { post, initialActivity = null }: Props = $props();

    // SEO 내부링크(#83): 서버 로드가 initialActivity 를 넘겨주면 SSR HTML 에
    // 최근 글/댓글 앵커가 포함되어야 한다. $effect 는 SSR 에서 실행되지 않으므로
    // 초기 state 를 props 에서 직접 계산한다 (클라 스트리밍 갱신은 아래 $effect).
    const hasInitial = !!(
        initialActivity &&
        (initialActivity.recentPosts.length > 0 || initialActivity.recentComments.length > 0)
    );

    let loading = $state(!hasInitial);
    let recentPosts = $state<RecentPost[]>(hasInitial ? initialActivity!.recentPosts : []);
    let recentComments = $state<RecentComment[]>(hasInitial ? initialActivity!.recentComments : []);
    /**
     * ⛔ **AdSense `<ins>` 를 SSR HTML 에 내보내면 안 된다.**
     *
     * `adsbygoogle.js` 는 app.html 에서 `async` 로 먼저 로드되고, 문서에서 `ins.adsbygoogle` 를
     * 찾아 **하이드레이션보다 먼저 채울 수 있다.** 그러면 Svelte 가 기대한 DOM 과 달라져
     * 하이드레이션이 통째로 폐기된다(글쓰기 버튼 안 먹힘·깜빡임·로그인 오표시).
     *
     * 실측(2026-08-24, 봇 제외 12시간):
     *   글 상세 4.08%  ·  홈 0.27%  ·  목록 0.06%    ← 글 상세만 68배
     *   브라우저: 파이어폭스 22% · 엣지 6.6% · 데스크톱크롬 3.8% · 모바일 0.4~0.7%
     *   실패는 888개 글에 **고르게** 퍼져 있다 — 특정 글의 콘텐츠 문제가 아니라 페이지 구조다.
     *   이 패널은 **글 상세에만** 있고, 저장소에서 `<ins>` 를 SSR 로 내보내는 유일한 곳이다.
     *
     * 우리 `AdfitSlot` 은 이미 `{#if ready}` 로 마운트 후에만 그린다. 그 패턴에 맞춘다.
     *
     * ⛔ 레이아웃은 안 변한다 — `.dm-clip-wrapper` 가 CSS 로 높이를 고정(모바일 110px /
     *    데스크톱 214px)하므로 `<ins>` 유무가 자리를 바꾸지 않는다. CLS 회귀 없음.
     */
    let adReady = $state(false);
    let adContainer = $state<HTMLElement | null>(null);
    let clipWrapper = $state<HTMLElement | null>(null);
    let panelEl = $state<HTMLElement | null>(null);
    /**
     * 모바일 펼침 상태 저장 키 (#13077).
     *
     * ⛔ 모바일에만 적용한다. 데스크톱은 접어도 공간이 줄지 않기 때문이다 —
     * 광고 열이 DESKTOP_AD_MAX_HEIGHT(190px) 로 !important 고정돼 있어,
     * 활동 카드를 접으면 헤더만 남아도 그 190px 이 그리드 행 높이를 지배한다.
     * 반면 모바일 블록(sm:hidden)은 광고 그리드와 분리돼 있어 접으면 실제로 줄어든다.
     *
     * 서버 동기화(ui-settings)가 아니라 localStorage 를 쓰는 이유:
     * 화면 크기에 종속된 표시 취향이라 기기 간 공유가 오히려 부자연스럽다.
     * 같은 디렉터리의 angmap-pin-map.svelte 가 같은 방식을 쓴다.
     */
    const MOBILE_EXPANDED_KEY = 'author_activity_mobile_expanded';

    let mobileExpanded = $state(false);
    let shouldLoad = $state(false);
    let desktopExpanded = $state(hasInitial);
    // SSR(initialActivity)로 이미 채워졌는지 — 클릭 시 클라 API 재fetch 방지 + 펼침 표시
    let ssrLoaded = $state(hasInitial);

    // SSR 스트리밍으로 작성자 활동이 늦게 도착한 경우(서버 확정 데이터가 없던 페이지)
    // 클릭 없이 즉시 반영. 데스크톱은 자동 펼침. 모바일은 공간 절약 위해 접어둠 —
    // 데이터는 preload 라 탭하면 추가 fetch 없이 즉시 표시(ssrLoaded 가드).
    $effect(() => {
        if (
            initialActivity &&
            (initialActivity.recentPosts.length > 0 || initialActivity.recentComments.length > 0)
        ) {
            recentPosts = initialActivity.recentPosts;
            recentComments = initialActivity.recentComments;
            loading = false;
            ssrLoaded = true;
            desktopExpanded = true;
        }
    });
    const MOBILE_AD_MAX_HEIGHT = 88;
    const DESKTOP_AD_MAX_HEIGHT = 190;
    const ADSENSE_ACTIVITY_CLIENT =
        import.meta.env.VITE_ADSENSE_ACTIVITY_CLIENT || 'ca-pub-2456249131797827';
    const ADSENSE_ACTIVITY_SLOT = import.meta.env.VITE_ADSENSE_ACTIVITY_SLOT || '1893595467';

    // 표기는 content-label 유틸이 단일 판정한다(#13095, #13097).
    // 이전엔 화면마다 문구가 갈라졌고, 텍스트 없는 댓글이 이모티콘·이미지·빈댓글 구분 없이
    // 전부 '(내용 없음)' 으로 뭉개졌다.
    // #13174: label.linkable 을 실제로 적용한다 — 삭제 항목은 <a> 없이 <span> 으로.
    // (7/26 수정이 문구만 통일하고 링크 제거는 미적용이었다. 렌더는 아래 snippet 두 개가 단일 정본.)
    function commentText(label: ContentLabel): string {
        return label.badge ? `${label.badge} ${label.text}` : label.text;
    }

    function getTargetHeight(): number {
        if (!browser) return DESKTOP_AD_MAX_HEIGHT;
        return window.matchMedia('(max-width: 639px)').matches
            ? MOBILE_AD_MAX_HEIGHT
            : DESKTOP_AD_MAX_HEIGHT;
    }

    function enforceClipHeight(): void {
        if (!clipWrapper) return;
        const h = getTargetHeight();
        const target = `${h}px`;
        if (
            clipWrapper.style.getPropertyValue('height') === target &&
            clipWrapper.style.getPropertyPriority('height') === 'important' &&
            clipWrapper.style.getPropertyValue('max-height') === target &&
            clipWrapper.style.getPropertyValue('min-height') === target
        )
            return;
        clipWrapper.style.setProperty('min-height', target, 'important');
        clipWrapper.style.setProperty('height', target, 'important');
        clipWrapper.style.setProperty('max-height', target, 'important');
    }

    function loadAdSense(): void {
        if (!browser || !adContainer) return;

        const adsenseClient = ADSENSE_ACTIVITY_CLIENT;
        if (!adsenseClient) return; // 환경변수 미설정 시 광고 미표시

        if (!document.querySelector(`script[src*="${adsenseClient}"]`)) {
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            document.head.appendChild(script);
        }

        try {
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch {
            // AdSense 초기화 실패 시 무시
        }
    }

    // 사용자가 패널을 직접 펼칠 때만 활동 API 호출
    $effect(() => {
        const authorId = post.author_id;
        if (!browser || !authorId) {
            loading = false;
            return;
        }
        // SSR(initialActivity)로 이미 채워졌으면 클라 API 재호출 불필요
        if (ssrLoaded) {
            loading = false;
            return;
        }
        if (!shouldLoad) {
            loading = false;
            return;
        }

        loading = true;
        recentPosts = [];
        recentComments = [];

        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/members/${authorId}/activity?limit=5`, {
                    signal: controller.signal
                });
                if (res.ok && !controller.signal.aborted) {
                    const data = await res.json();
                    recentPosts = data.recentPosts ?? [];
                    recentComments = data.recentComments ?? [];
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                // 실패 시 조용히 처리
            } finally {
                if (!controller.signal.aborted) loading = false;
            }
        })();

        return () => {
            controller.abort();
        };
    });

    function toggleDesktopExpanded(): void {
        desktopExpanded = !desktopExpanded;
        if (desktopExpanded) {
            shouldLoad = true;
        }
    }

    function toggleMobileExpanded(): void {
        mobileExpanded = !mobileExpanded;
        if (mobileExpanded) {
            shouldLoad = true;
        }
        try {
            localStorage.setItem(MOBILE_EXPANDED_KEY, mobileExpanded ? '1' : '0');
        } catch {
            // 프라이빗 모드 등 — 상태 기억만 포기하고 동작은 유지
        }
    }

    onMount(() => {
        let mutationObserver: MutationObserver | undefined;
        let resizeObserver: ResizeObserver | undefined;
        const handleResize = () => enforceClipHeight();

        // 지난번에 모바일에서 펼쳐뒀다면 복원 (#13077).
        // 기본값은 접힘 그대로라, 한 번도 펼친 적 없는 사용자에겐 변화가 없다.
        try {
            if (localStorage.getItem(MOBILE_EXPANDED_KEY) === '1') {
                mobileExpanded = true;
                shouldLoad = true;
            }
        } catch {
            // 프라이빗 모드 등 — 기본값(접힘) 유지
        }

        // ⛔ 순서가 중요하다. `<ins>` 가 DOM 에 들어간 **뒤에** push 해야 AdSense 가 찾는다.
        //    SSR 로 내보내지 않으므로 여기서 그리고, tick 으로 DOM 반영을 기다린다.
        // ⛔ clipWrapper·adContainer 는 이제 **SSR 에 없다**(위 {#if adReady}).
        //    adReady 를 켠 뒤 tick 으로 DOM 반영을 기다려야 bind:this 가 채워진다.
        //    rAF 를 tick 밖에 두면 참조가 비어 높이 방어가 통째로 죽는다.
        adReady = true;
        void tick().then(() => {
            loadAdSense();
            requestAnimationFrame(() => {
                if (!clipWrapper) return;
                enforceClipHeight();
                mutationObserver = new MutationObserver(() => enforceClipHeight());
                mutationObserver.observe(clipWrapper, {
                    attributes: true,
                    attributeFilter: ['style']
                });

                if (typeof ResizeObserver !== 'undefined') {
                    resizeObserver = new ResizeObserver(() => enforceClipHeight());
                    resizeObserver.observe(clipWrapper);
                    if (panelEl) resizeObserver.observe(panelEl);
                } else {
                    window.addEventListener('resize', handleResize);
                }
            });
        });

        return () => {
            mutationObserver?.disconnect();
            resizeObserver?.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    });
</script>

<!-- 최근 글/댓글 한 줄 렌더 정본 — 삭제 항목(linkable:false)은 링크 없이 표시 (#13174) -->
{#snippet postItem(p: RecentPost)}
    {@const label = getPostLabel(p)}
    {#if label.linkable}
        <a href={p.href} class="text-foreground hover:text-primary block min-w-0 truncate text-xs">
            {label.text}
        </a>
    {:else}
        <span class="text-muted-foreground block min-w-0 truncate text-xs">{label.text}</span>
    {/if}
{/snippet}

{#snippet commentItem(c: RecentComment)}
    {@const label = getCommentLabel(c)}
    {#if label.linkable}
        <a
            href={c.href}
            class="text-foreground hover:text-primary block min-w-0 truncate text-xs"
            onclick={(e) => {
                const hash = c.href.split('#')[1];
                if (hash && window.location.pathname === c.href.split('#')[0]) {
                    e.preventDefault();
                    const el = document.getElementById(hash);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        el.style.transition = 'background-color 0.3s ease';
                        el.style.backgroundColor = 'hsl(var(--primary) / 0.1)';
                        el.style.borderRadius = '0.5rem';
                        setTimeout(() => {
                            el.style.backgroundColor = '';
                            setTimeout(() => {
                                el.style.transition = '';
                                el.style.borderRadius = '';
                            }, 300);
                        }, 2000);
                    }
                }
            }}
        >
            {commentText(label)}
        </a>
    {:else}
        <span class="text-muted-foreground block min-w-0 truncate text-xs">
            {commentText(label)}
        </span>
    {/if}
{/snippet}

{#if post.author_id && !post.deleted_at}
    <div class="dm-ad-row mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3" bind:this={panelEl}>
        <!-- ⛔ 광고 칸 전체를 마운트 후에만 그린다 — SSR 에 내보내면 차단기가 하이드레이션
             **전에** 지워서 Svelte 가 트리 전체를 폐기한다(2026-08-25 실측: 실패의 73.6%에
             하이드레이션 전 DOM 변형, 성공은 0%. 지워진 대상 `div.flex.flex-col` 121/121,
             주체 `local.adguard.org` 95%).
             ⛔ #2189 는 `<ins>` 만 뺐고 **이 껍데기를 남겨서 효과가 0** 이었다. 경계는
                반드시 이 바깥이어야 한다 — Svelte 5 는 한 곳만 어긋나도 전체를 버린다.
             ⛔ 되돌릴 때 SSR 로 다시 내보내지 마라. 같은 증상이 그대로 재발한다. -->
        {#if adReady}
            <!-- AdSense 광고 -->
            <div class="flex flex-col">
                <!-- 외부 클리핑 래퍼: MutationObserver로 AdSense의 height 덮어쓰기 방어 -->
                <!-- 모바일: max-height 100px로 제한 / 데스크톱: 카드 높이에 맞춤 -->
                <div
                    bind:this={clipWrapper}
                    class="dm-clip-wrapper overflow-hidden rounded-xl"
                    style="position: relative;"
                >
                    <!-- AdSense가 이 div의 height를 !important로 바꿔도 외부 래퍼가 잘라냄 -->
                    <div bind:this={adContainer}>
                        {#if ADSENSE_ACTIVITY_CLIENT && ADSENSE_ACTIVITY_SLOT}
                            <ins
                                class="adsbygoogle"
                                style="display:block;"
                                data-ad-client={ADSENSE_ACTIVITY_CLIENT}
                                data-ad-slot={ADSENSE_ACTIVITY_SLOT}
                                data-ad-format="auto"
                                data-full-width-responsive="true"
                            ></ins>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}

        <!-- ⛔ `sm:col-start-2` 를 빼지 마라. 광고 칸이 SSR 에 없으므로, 이게 없으면
             CSS 그리드 자동배치가 Card 를 **1-2열**에 놓았다가 마운트 후 광고가 1열을
             차지하면서 **2-3열로 민다** — 데스크톱에서 ~300px 가로 밀림이다.
             .dm-ad-row 의 min-height 가 세로를 잡듯, 이건 가로를 잡는다. -->
        <Card class="hidden gap-0 sm:col-span-2 sm:col-start-2 sm:flex">
            <CardHeader class="pb-2 pt-2">
                <button
                    type="button"
                    class="text-foreground flex w-full items-center justify-between text-sm font-semibold"
                    onclick={toggleDesktopExpanded}
                >
                    작성자 최근 활동
                    {#if desktopExpanded}
                        <ChevronUp class="h-4 w-4" />
                    {:else}
                        <ChevronDown class="h-4 w-4" />
                    {/if}
                </button>
            </CardHeader>
            {#if desktopExpanded}
                <CardContent class="grid grid-cols-2 gap-4 pb-2 pt-0">
                    <div>
                        <h2 class="text-foreground mb-2 text-sm font-semibold">최근 글</h2>
                        {#if loading}
                            <div class="flex justify-center py-4">
                                <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                            </div>
                        {:else if recentPosts.length === 0}
                            <p class="text-muted-foreground py-2 text-xs">자료 없음</p>
                        {:else}
                            <ul class="divide-border divide-y">
                                {#each recentPosts as p (`${p.bo_table}_${p.wr_id}`)}
                                    <li class="py-1">
                                        {@render postItem(p)}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                    <div>
                        <h2 class="text-foreground mb-2 text-sm font-semibold">최근 댓글</h2>
                        {#if loading}
                            <div class="flex justify-center py-4">
                                <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                            </div>
                        {:else if recentComments.length === 0}
                            <p class="text-muted-foreground py-2 text-xs">자료 없음</p>
                        {:else}
                            <ul class="divide-border divide-y">
                                {#each recentComments as c (`${c.bo_table}_${c.wr_id}`)}
                                    <li class="py-1">
                                        {@render commentItem(c)}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </CardContent>
            {/if}
        </Card>
    </div>

    <!-- 모바일: 작성자 활동 접기/펼치기 -->
    <div class="mb-4 sm:hidden">
        <button
            type="button"
            onclick={toggleMobileExpanded}
            class="text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 py-1.5 text-xs transition-colors"
        >
            작성자 최근 활동
            {#if mobileExpanded}
                <ChevronUp class="h-3.5 w-3.5" />
            {:else}
                <ChevronDown class="h-3.5 w-3.5" />
            {/if}
        </button>
        {#if mobileExpanded}
            <div class="grid grid-cols-2 gap-2" transition:slide={{ duration: 200 }}>
                <Card class="gap-0">
                    <CardHeader class="pb-0 pt-2">
                        <h2 class="text-foreground text-xs font-semibold">최근 글</h2>
                    </CardHeader>
                    <CardContent class="pb-2 pt-0">
                        {#if loading}
                            <div class="flex justify-center py-4">
                                <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                            </div>
                        {:else if recentPosts.length === 0}
                            <p class="text-muted-foreground py-2 text-xs">자료 없음</p>
                        {:else}
                            <ul class="divide-border divide-y">
                                {#each recentPosts as p (`${p.bo_table}_${p.wr_id}`)}
                                    <li class="py-1">
                                        {@render postItem(p)}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </CardContent>
                </Card>
                <Card class="gap-0">
                    <CardHeader class="pb-0 pt-2">
                        <h2 class="text-foreground text-xs font-semibold">최근 댓글</h2>
                    </CardHeader>
                    <CardContent class="pb-2 pt-0">
                        {#if loading}
                            <div class="flex justify-center py-4">
                                <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                            </div>
                        {:else if recentComments.length === 0}
                            <p class="text-muted-foreground py-2 text-xs">자료 없음</p>
                        {:else}
                            <ul class="divide-border divide-y">
                                {#each recentComments as c (`${c.bo_table}_${c.wr_id}`)}
                                    <li class="py-1">
                                        {@render commentItem(c)}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </CardContent>
                </Card>
            </div>
        {/if}
    </div>
{/if}

<style>
    /* ⛔ 광고 칸을 SSR 에서 빼면(위 {#if adReady}) 모바일에서 그리드가 **높이 0** 이 된다 —
       옆 Card 가 `hidden sm:flex` 라 모바일에선 광고 칸이 그리드의 유일한 자식이기 때문이다.
       마운트 후 110px 이 생기며 아래를 밀어 CLS 가 난다. 그래서 자리를 미리 잡는다.
       ⛔ 값은 CSS 의 110/214 가 아니라 **JS 가 !important 로 강제하는 실제 높이**여야 한다
          (MOBILE_AD_MAX_HEIGHT=88 / DESKTOP_AD_MAX_HEIGHT=190). CSS 값으로 잡으면
          페이지가 영구히 22~24px 커진다 — 밀림은 없애고 높이를 늘리는 헛수고가 된다.
          그 상수를 바꾸면 여기도 같이 바꿔라.
       ⚠️ 차단기가 광고 칸을 지운 사용자에게는 이만큼 빈 공간이 남는다 — 의도한 맞바꿈이다
          (밀림은 전원에게, 빈 공간은 차단 사용자에게만). */
    .dm-ad-row {
        min-height: 88px;
    }
    @media (min-width: 640px) {
        .dm-ad-row {
            min-height: 190px;
        }
    }

    /* 모바일은 낮게, 데스크톱은 카드형 비율로 보이도록 높이를 제한합니다. */
    .dm-clip-wrapper {
        min-height: 110px;
        height: 110px;
        max-height: 110px;
        background: hsl(var(--background));
        isolation: isolate;
    }
    @media (min-width: 640px) {
        .dm-clip-wrapper {
            min-height: 214px;
            height: 214px;
            max-height: 214px;
        }
    }
</style>
