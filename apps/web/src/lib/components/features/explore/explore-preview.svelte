<script lang="ts">
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import Compass from '@lucide/svelte/icons/compass';
    import Heart from '@lucide/svelte/icons/heart';
    import {
        formatNumber,
        getRecommendBadgeClass,
        shortenBoardName
    } from '$lib/components/features/recommended/utils/index.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte.js';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import type { ExploreData, ExploreMode, ExplorePost } from '$lib/api/types.js';
    import { TimedFetchError, timedFetch } from '$lib/utils/timed-fetch';

    interface Props {
        prefetchData?: { data: ExploreData } | unknown;
        // 공감글(RecommendedPosts)에 이미 뜬 글 id — 모아보기에서 제외해 홈 중복 노출 방지.
        // 공감글 우선 규칙: 같은 글이 양쪽에 걸리면 공감글에만 남기고 여기선 뺀다.
        excludeIds?: Set<number>;
    }

    const { prefetchData, excludeIds }: Props = $props();

    const ssrData = prefetchData as { data: ExploreData } | undefined;
    let exploreData = $state<ExploreData | null>(ssrData?.data ?? null);
    let loading = $state(!ssrData?.data);
    let showReadState = $state(false);

    const PREVIEW_COUNT = 17;

    const modes: { id: ExploreMode; label: string }[] = [
        { id: 'hot', label: '핫' },
        { id: 'new', label: '최신' },
        { id: 'rising', label: '급상승' },
        { id: 'top', label: '인기' }
    ];

    let activeMode = $state<ExploreMode>('hot');
    let rootEl = $state<HTMLElement | null>(null);
    let requested = $state(false);
    let loadStatus = $state<'idle' | 'loading' | 'success' | 'error'>(
        ssrData?.data ? 'success' : 'idle'
    );
    let errorMessage = $state<string | null>(null);

    const modePosts = $derived.by<ExplorePost[]>(() => {
        if (!exploreData?.modes) return [];
        const modeData = exploreData.modes[activeMode];
        if (!modeData) return [];
        let posts: ExplorePost[];
        if (activeMode === 'top') {
            posts = modeData.periods?.['24h'] ?? [];
        } else {
            posts = modeData.posts ?? [];
        }
        // 차단 사용자 + 차단 키워드(제목) 제외 + 공감글 중복 제외 후 PREVIEW_COUNT 로 채운다
        // (제외를 slice 앞에 둬야 빠진 만큼 다른 글로 채워져 목록이 빈약해지지 않음). (#13598)
        return posts
            .filter((p) => !blockedUsersStore.isBlocked(p.author))
            .filter((p) => !uiSettingsStore.isMuted(p.title))
            .filter((p) => !excludeIds || !excludeIds.has(p.id))
            .slice(0, PREVIEW_COUNT);
    });

    async function loadExploreData(): Promise<void> {
        if (loadStatus === 'loading') return;
        if (exploreData) {
            loading = false;
            loadStatus = 'success';
            return;
        }

        requested = true;
        loadStatus = 'loading';
        errorMessage = null;

        try {
            // timed-fetch: 12s 타임아웃 + 1회 retry → silent fail / 영구 placeholder 방지 (audit 2-2)
            const res = await timedFetch(
                '/api/widgets/explore/data',
                {},
                { timeout: 12_000, retries: 1, throwOnHTTPError: true }
            );
            exploreData = await res.json();
            loadStatus = 'success';
        } catch (err) {
            if (err instanceof TimedFetchError) {
                if (err.kind === 'timeout') {
                    errorMessage = '응답이 늦어지고 있어요.';
                } else if (err.kind === 'network') {
                    errorMessage = '네트워크 오류로 불러오지 못했어요.';
                } else if (err.kind === 'http') {
                    errorMessage = `데이터를 불러오지 못했어요 (HTTP ${err.status ?? '?'})`;
                } else {
                    errorMessage = '요청이 취소되었어요.';
                }
            } else {
                errorMessage = '데이터를 불러오지 못했어요.';
            }
            loadStatus = 'error';
            console.error('모아보기 위젯 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    function retryExplore(): void {
        // 재시도 가능하도록 requested 플래그 리셋
        requested = false;
        loadStatus = 'idle';
        errorMessage = null;
        loading = true;
        void loadExploreData();
    }

    function scheduleLoad(): void {
        if (!browser || requested || exploreData) return;

        const task = () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            void loadExploreData();
        };

        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(task, { timeout: 1500 });
            return;
        }

        globalThis.setTimeout(task, 250);
    }

    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });

        if (exploreData) {
            loading = false;
            return;
        }

        if (!rootEl || typeof IntersectionObserver === 'undefined') {
            scheduleLoad();
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect();
                    void loadExploreData();
                }
            },
            { rootMargin: '200px 0px' }
        );

        observer.observe(rootEl);

        return () => {
            observer.disconnect();
        };
    });

    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }
</script>

<div bind:this={rootEl}>
    <Card class="gap-0">
        <CardHeader class="flex flex-row items-center justify-between gap-2 py-3">
            <a
                href="/explore"
                class="hover:text-foreground flex shrink-0 items-center gap-2 transition-colors"
            >
                <div
                    class="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30"
                >
                    <Compass class="h-4 w-4 text-teal-500" />
                </div>
                <h3 class="text-foreground text-lg font-semibold">모아보기</h3>
            </a>
            <div class="flex gap-1 overflow-x-auto">
                {#each modes as mode (mode.id)}
                    <button
                        type="button"
                        class="shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-all
                        {activeMode === mode.id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        onclick={() => (activeMode = mode.id)}
                    >
                        {mode.label}
                    </button>
                {/each}
            </div>
        </CardHeader>

        <CardContent class="">
            {#if loading}
                <div class="space-y-2">
                    {#each Array(5) as _}
                        <div class="flex items-center gap-2 py-1">
                            <div class="bg-muted h-5 w-10 animate-pulse rounded-full"></div>
                            <div class="bg-muted h-4 flex-1 animate-pulse rounded"></div>
                        </div>
                    {/each}
                </div>
            {:else if loadStatus === 'error'}
                <div class="text-muted-foreground py-6 text-center text-sm">
                    <p>{errorMessage ?? '데이터를 불러오지 못했어요.'}</p>
                    <button
                        type="button"
                        class="text-primary mt-2 inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
                        onclick={retryExplore}
                    >
                        <Compass class="h-3 w-3" />
                        다시 불러오기
                    </button>
                </div>
            {:else if modePosts.length === 0}
                <div class="text-muted-foreground py-6 text-center text-sm">
                    데이터를 준비하고 있습니다...
                </div>
            {:else}
                <ul>
                    {#each modePosts as post (post.board + '-' + post.id)}
                        <li>
                            <!--
                                ⭐ 터치 타깃 최소 44px (구글·애플 공통 권장). 이 링크는 36px 이고 인접
                                   간격이 0px 이라 손가락이 두 링크에 걸쳤다 — 실사용자 오터치 계측에서
                                   홈만 하루 542건, 어긋난 px 의 87%가 10~39px 로 링크 높이 자체와
                                   일치했다(행 밀림이 아니다).
                                ⛔ padding 을 키워서 44px 을 만들지 말 것. --row-pad-extra 는 회원의 UI
                                   밀도 설정(compact 0 / balanced 3 / relaxed 6px)이라 곱해지면 relaxed 가
                                   56px 로 과해진다. min-height 는 바닥만 보장하므로 밀도를 크게 쓰는
                                   회원 설정은 그대로다.
                                ⛔ 44px 은 **터치 기기에서만** 건다. 2026-09-04 에 인라인 style 로 넣었더니 인라인은
                                   미디어쿼리를 못 써 마우스에도 걸렸고, 1440px 데스크톱 홈이 +592px 늘어났다.
                                   지금은 app.css 의 `.widget-post-row` 가 `(hover:none) and (pointer:coarse)` 안에서만
                                   min-height/flex 를 켠다. 데스크톱은 그 클래스의 기본값 display:block 그대로다.
                                ⛔ padding 만 인라인에 남긴다. 인라인이 Tailwind 를 이겨서 class 의 py-* 는 이미
                                   무시되고 있다 — 이 계산식을 클래스로 옮기면 그 관계가 뒤집힌다. 그대로 둔다.
     * ⛔ 2026-09-07 정정 — 「특이성이 같아 번들 순서로 갈린다」는 **틀렸다**.
     *    빌드된 CSS 실측: `.block` 은 `@layer utilities` **안**, `.widget-post-row` 는
     *    **레이어 밖**이다. unlayered 가 레이어보다 **항상** 이기므로 순서와 무관하게 결정적이다.
                                   번들 순서로 승자가 갈린다. display 기본값은 `.widget-post-row` 가 직접 든다.
                            -->
                            <a
                                href={post.url}
                                class="hover:bg-muted widget-post-row rounded px-0.5 py-1.5 transition-all duration-200 ease-out"
                                style="padding-top: calc(0.125rem + var(--row-pad-extra, 0px)); padding-bottom: calc(0.125rem + var(--row-pad-extra, 0px));"
                            >
                                <div class="flex items-center gap-1">
                                    <!-- 추천수 배지 -->
                                    <span
                                        class="inline-flex w-[2.75rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                                            post.recommend_count
                                        )}"
                                    >
                                        <Heart class="size-3" />
                                        {formatNumber(post.recommend_count)}
                                    </span>

                                    <!-- 게시판 뱃지 -->
                                    <span
                                        class="bg-muted text-muted-foreground hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline-block"
                                    >
                                        {shortenBoardName(post.board_name)}
                                    </span>

                                    <!-- 제목 -->
                                    <span
                                        class="min-w-0 flex-1 truncate leading-relaxed {getReadPostClasses(
                                            showReadState &&
                                                readPostsStore.isRead(getBoardId(post.url), post.id)
                                        )}"
                                        style="font-size: var(--list-font-size);"
                                    >
                                        {post.title}
                                    </span>
                                </div>
                            </a>
                        </li>
                    {/each}
                </ul>
            {/if}
        </CardContent>
    </Card>
</div>
