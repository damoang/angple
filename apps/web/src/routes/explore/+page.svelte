<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { page } from '$app/state';
    import { replaceState } from '$app/navigation';
    import { SeoHead } from '$lib/seo/index.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import Compass from '@lucide/svelte/icons/compass';
    import Flame from '@lucide/svelte/icons/flame';
    import Clock from '@lucide/svelte/icons/clock';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import Crown from '@lucide/svelte/icons/crown';
    import Eye from '@lucide/svelte/icons/eye';
    import Heart from '@lucide/svelte/icons/heart';
    import {
        formatNumber,
        getRecommendBadgeClass
    } from '$lib/components/features/recommended/utils/index.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte.js';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import TagNav from '$lib/components/ui/tag-nav/tag-nav.svelte';
    import { formatCommentCountBadge } from '$lib/utils/comment-count.js';
    import type { PageData } from './$types';
    import type {
        ExploreMode,
        ExploreTopPeriod,
        ExplorePost,
        ExploreComment
    } from '$lib/api/types.js';

    let { data }: { data: PageData } = $props();

    type ExploreViewMode = 'posts' | 'comments';

    /**
     * 탭·기간·보기·게시판 선택을 URL 쿼리(+ 히스토리 state)에 보관한다.
     * 글을 열었다 뒤로 오거나 새로고침해도 같은 화면으로 돌아오게 하기 위함.
     *
     * - 기본값과 같은 키는 쿼리에서 뺀다 → 기본 화면의 주소는 그대로 `/explore`.
     * - 초기값은 SSR·클라이언트 모두 같은 입력(`page.url`)에서 계산한다 → 서버가 처음부터
     *   맞는 탭을 그리므로 깜빡임·밀림이 없고 하이드레이션 값도 일치한다.
     * - 쿼리 변경은 load 를 다시 돌리지 않도록 shallow `replaceState` 로만 한다
     *   (load 는 `url` 을 읽지 않는다).
     * - shallow `replaceState` 는 `page.url` 을 바꾸지 않고, 뒤로가기 때 SvelteKit 은 그 항목의
     *   원래 `page.url`(쿼리 없음)로 이동한다. 대신 같이 저장한 `page.state` 는 돌려주므로
     *   뒤로가기 복원은 `page.state` 를, 새로고침·공유 링크는 쿼리를 쓴다.
     */
    const DEFAULT_MODE: ExploreMode = 'hot';
    const DEFAULT_PERIOD: ExploreTopPeriod = '24h';
    const DEFAULT_VIEW: ExploreViewMode = 'posts';
    const DEFAULT_BOARD = 'all';

    const MODE_VALUES: readonly ExploreMode[] = ['hot', 'new', 'rising', 'top'];
    const PERIOD_VALUES: readonly ExploreTopPeriod[] = ['24h', '7d', '30d'];
    const VIEW_VALUES: readonly ExploreViewMode[] = ['posts', 'comments'];
    const BOARD_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

    interface ExploreSelection {
        mode: ExploreMode;
        period: ExploreTopPeriod;
        view: ExploreViewMode;
        board: string;
    }

    function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
        return typeof value === 'string' && (allowed as readonly string[]).includes(value)
            ? (value as T)
            : fallback;
    }

    function pickBoard(value: unknown): string {
        return typeof value === 'string' && BOARD_PATTERN.test(value) ? value : DEFAULT_BOARD;
    }

    function readInitialSelection(): ExploreSelection {
        // 뒤로가기(popstate)로 돌아온 경우: 히스토리 state 가 최신 선택을 들고 있다.
        const saved = (page.state as { explore?: Partial<ExploreSelection> } | undefined)?.explore;
        const params = page.url.searchParams;
        const source = saved ?? {
            mode: params.get('mode'),
            period: params.get('period'),
            view: params.get('view'),
            board: params.get('board')
        };
        return {
            mode: pick(source.mode, MODE_VALUES, DEFAULT_MODE),
            period: pick(source.period, PERIOD_VALUES, DEFAULT_PERIOD),
            view: pick(source.view, VIEW_VALUES, DEFAULT_VIEW),
            board: pickBoard(source.board)
        };
    }

    const initialSelection = readInitialSelection();

    let activeMode = $state<ExploreMode>(initialSelection.mode);
    let topPeriod = $state<ExploreTopPeriod>(initialSelection.period);
    let viewMode = $state<ExploreViewMode>(initialSelection.view);
    let selectedBoard = $state<string>(initialSelection.board);
    let showReadState = $state(false);

    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });
    });

    const modes = [
        { id: 'hot' as const, label: '핫', icon: Flame },
        { id: 'new' as const, label: '최신', icon: Clock },
        { id: 'rising' as const, label: '떠오르는', icon: TrendingUp },
        { id: 'top' as const, label: '인기', icon: Crown }
    ];

    const topPeriods: { id: ExploreTopPeriod; label: string }[] = [
        { id: '24h', label: '오늘' },
        { id: '7d', label: '이번 주' },
        { id: '30d', label: '이번 달' }
    ];

    const currentPosts = $derived.by((): ExplorePost[] => {
        if (!data.exploreData) return [];
        const modeData = data.exploreData.modes[activeMode];
        if (!modeData) return [];
        if (activeMode === 'top' && modeData.periods) {
            return modeData.periods[topPeriod] || [];
        }
        return modeData.posts || [];
    });

    const currentComments = $derived.by((): ExploreComment[] => {
        if (!data.exploreData) return [];
        const modeData = data.exploreData.modes[activeMode];
        if (!modeData) return [];
        if (activeMode === 'top' && modeData.comment_periods) {
            return modeData.comment_periods[topPeriod] || [];
        }
        return modeData.comments || [];
    });

    const hasComments = $derived.by((): boolean => {
        if (!data.exploreData) return false;
        const modeData = data.exploreData.modes[activeMode];
        if (!modeData) return false;
        if (activeMode === 'top' && modeData.comment_periods) {
            return (
                (modeData.comment_periods['24h']?.length ?? 0) +
                    (modeData.comment_periods['7d']?.length ?? 0) +
                    (modeData.comment_periods['30d']?.length ?? 0) >
                0
            );
        }
        return (modeData.comments?.length ?? 0) > 0;
    });

    const availableBoards = $derived.by(() => {
        const items = viewMode === 'posts' ? currentPosts : currentComments;
        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- $derived.by 내부 지역 변수.
        const seenBoards = new Set<string>();
        const boards: { id: string; label: string }[] = [];

        for (const item of items) {
            if (!seenBoards.has(item.board)) {
                seenBoards.add(item.board);
                boards.push({ id: item.board, label: item.board_name });
            }
        }

        return [{ id: 'all', label: '전체' }, ...boards];
    });

    const filteredPosts = $derived.by((): ExplorePost[] => {
        const byBoard =
            selectedBoard === 'all'
                ? currentPosts
                : currentPosts.filter((post) => post.board === selectedBoard);
        // 차단 회원 + 차단 키워드(제목) 제외 (#13598)
        return byBoard.filter(
            (post) =>
                !blockedUsersStore.isBlocked(post.author) && !uiSettingsStore.isMuted(post.title)
        );
    });

    const filteredComments = $derived.by((): ExploreComment[] => {
        const byBoard =
            selectedBoard === 'all'
                ? currentComments
                : currentComments.filter((comment) => comment.board === selectedBoard);
        // 차단 회원 + 차단 키워드(원글 제목·댓글 본문) 제외 (#13598)
        return byBoard.filter(
            (comment) =>
                !blockedUsersStore.isBlocked(comment.author) &&
                !uiSettingsStore.isMuted(comment.parent_title ?? '') &&
                !uiSettingsStore.isMuted(comment.content ?? '')
        );
    });

    // 초기값 보정 — SSR 에서도 같은 결과가 나오도록 스크립트 본문에서 동기로 한다
    // ($effect 는 SSR 에서 돌지 않아, 여기서 안 고치면 서버가 빈 목록을 그린 뒤 바뀐다).
    untrack(() => {
        if (viewMode === 'comments' && !hasComments) viewMode = DEFAULT_VIEW;
        if (!availableBoards.some((board) => board.id === selectedBoard)) {
            selectedBoard = DEFAULT_BOARD;
        }
    });

    /** 선택을 바꾸고 URL 쿼리·히스토리 state 에 반영한다. 클릭 핸들러에서만 부른다. */
    function updateSelection(patch: Partial<ExploreSelection>) {
        if (patch.mode !== undefined) activeMode = patch.mode;
        if (patch.period !== undefined) topPeriod = patch.period;
        if (patch.view !== undefined) viewMode = patch.view;
        if (patch.board !== undefined) selectedBoard = patch.board;
        // 탭을 바꿔 선택한 게시판이 목록에서 사라지면 전체로 (아래 $effect 와 같은 규칙).
        if (!availableBoards.some((board) => board.id === selectedBoard)) {
            selectedBoard = DEFAULT_BOARD;
        }
        syncSelectionToUrl();
    }

    function syncSelectionToUrl() {
        const selection: ExploreSelection = {
            mode: activeMode,
            period: topPeriod,
            view: viewMode,
            board: selectedBoard
        };
        try {
            // 뒤로가기로 돌아온 뒤에는 page.url 에 쿼리가 없으므로 주소창 기준으로 만든다.
            const url = new URL(window.location.href);
            const entries: [string, string, string][] = [
                ['mode', selection.mode, DEFAULT_MODE],
                ['period', selection.period, DEFAULT_PERIOD],
                ['view', selection.view, DEFAULT_VIEW],
                ['board', selection.board, DEFAULT_BOARD]
            ];
            for (const [key, value, fallback] of entries) {
                if (value === fallback) url.searchParams.delete(key);
                else url.searchParams.set(key, value);
            }
            replaceState(url, { ...page.state, explore: selection });
        } catch {
            // 라우터 초기화 전 등 — URL 반영만 건너뛰고 화면 전환은 유지
        }
    }

    $effect(() => {
        if (!availableBoards.some((board) => board.id === selectedBoard)) {
            selectedBoard = 'all';
        }
    });

    function formatRelativeTime(dateString: string): string {
        const now = Date.now();
        const date = new Date(dateString).getTime();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return '방금';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
        return new Date(dateString).toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            month: 'short',
            day: 'numeric'
        });
    }

    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }

    function getPostId(post: ExplorePost): number {
        return post.id;
    }

    function stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '').trim();
    }
</script>

<SeoHead
    config={{
        meta: { title: '모아보기', description: '다모앙 전체 게시판 통합 피드' },
        og: { title: '모아보기 - 다모앙', type: 'website' }
    }}
/>

<!-- 좌우 여백은 모바일에서 게시판 목록과 맞춘다. 종전 px-4 는 상위 main 의 px-2 위에
     16px 을 더 얹어 콘텐츠가 24px 안쪽에서 시작했고, /free 목록(8px)과 어긋나 보였다.
     md 이상은 종전대로 px-4. 상하도 목록 페이지(pt-2)와 같은 기준으로. -->
<div class="mx-auto max-w-4xl px-0 pb-6 pt-2 md:px-4 md:py-6">
    <div class="mb-2">
        <TagNav />
    </div>

    <div class="mb-4">
        <AdSlot position="explore-top" height="90px" slotKey="explore-top" />
    </div>

    <Card class="gap-0">
        <CardHeader class="pb-0">
            <!-- 헤더 + 탭 한 줄 -->
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <Compass class="text-primary h-5 w-5" />
                    <h1 class="text-foreground text-lg font-bold">모아보기</h1>
                    {#if data.exploreData}
                        <span class="text-muted-foreground text-xs">
                            {data.exploreData.board_count}개 게시판
                        </span>
                    {/if}
                </div>

                <!-- 모드 탭 (데스크탑) -->
                <div class="hidden items-center gap-0.5 sm:flex">
                    {#each modes as mode (mode.id)}
                        <button
                            onclick={() => updateSelection({ mode: mode.id })}
                            class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-all duration-200 ease-out {activeMode ===
                            mode.id
                                ? 'bg-primary text-primary-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        >
                            <mode.icon class="h-3.5 w-3.5" />
                            {mode.label}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- 모드 탭 (모바일) -->
            <div class="mt-3 flex items-center gap-1 overflow-x-auto sm:hidden">
                {#each modes as mode (mode.id)}
                    <button
                        onclick={() => updateSelection({ mode: mode.id })}
                        class="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-all duration-200 ease-out {activeMode ===
                        mode.id
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                    >
                        <mode.icon class="h-3.5 w-3.5" />
                        {mode.label}
                    </button>
                {/each}
            </div>

            <!-- 인기 탭: 기간 하위 탭 -->
            {#if activeMode === 'top'}
                <div class="mt-2 flex items-center gap-1">
                    {#each topPeriods as period (period.id)}
                        <button
                            onclick={() => updateSelection({ period: period.id })}
                            class="rounded-md px-2.5 py-1 text-xs transition-all duration-200 ease-out {topPeriod ===
                            period.id
                                ? 'bg-accent text-accent-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        >
                            {period.label}
                        </button>
                    {/each}
                </div>
            {/if}

            {#if availableBoards.length > 1}
                <div class="mt-3 flex items-center gap-1 overflow-x-auto">
                    {#each availableBoards as board (board.id)}
                        <button
                            type="button"
                            onclick={() => updateSelection({ board: board.id })}
                            class="shrink-0 rounded-md px-2.5 py-1 text-xs transition-all duration-200 ease-out {selectedBoard ===
                            board.id
                                ? 'bg-accent text-accent-foreground font-medium'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        >
                            {board.label}
                        </button>
                    {/each}
                </div>
            {/if}

            <!-- 글/댓글 토글 -->
            {#if hasComments}
                <div class="mt-3 flex gap-1">
                    <button
                        type="button"
                        class="rounded-md px-3 py-1 text-sm font-medium transition-all {viewMode ===
                        'posts'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        onclick={() => updateSelection({ view: 'posts' })}
                    >
                        글
                    </button>
                    <button
                        type="button"
                        class="rounded-md px-3 py-1 text-sm font-medium transition-all {viewMode ===
                        'comments'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        onclick={() => updateSelection({ view: 'comments' })}
                    >
                        댓글
                    </button>
                </div>
            {/if}
        </CardHeader>

        <CardContent class="px-0 pb-0">
            {#if !data.exploreData}
                <div class="text-muted-foreground py-16 text-center">
                    <Compass class="text-muted-foreground/30 mx-auto mb-3 h-12 w-12" />
                    <p class="text-sm">데이터를 준비하고 있습니다...</p>
                </div>
            {:else if viewMode === 'posts'}
                <!-- 게시글 목록 -->
                {#if filteredPosts.length === 0}
                    <div class="text-muted-foreground py-16 text-center">
                        <p class="text-sm">표시할 글이 없습니다.</p>
                    </div>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each filteredPosts as post (post.board + '-' + post.id)}
                            <li>
                                <a
                                    href={post.url}
                                    class="hover:bg-muted flex items-center gap-2.5 px-4 py-2 transition-all duration-200 ease-out"
                                >
                                    <!-- 추천수 배지 -->
                                    <span
                                        class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
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
                                        {post.board_name}
                                    </span>

                                    <!-- 제목 -->
                                    <span
                                        class="min-w-0 flex-1 truncate leading-relaxed {getReadPostClasses(
                                            showReadState &&
                                                readPostsStore.isRead(
                                                    getBoardId(post.url),
                                                    getPostId(post)
                                                )
                                        )}"
                                        style="font-size: var(--list-font-size);"
                                    >
                                        {post.title}
                                    </span>

                                    <!-- 댓글 수 -->
                                    {#if post.comment_count > 0}
                                        <span class="text-primary shrink-0 text-xs font-medium">
                                            {formatCommentCountBadge(post.comment_count)}
                                        </span>
                                    {/if}

                                    <!-- 조회수 + 시간 (데스크탑) -->
                                    <span
                                        class="text-muted-foreground hidden shrink-0 items-center gap-3 text-xs sm:flex"
                                    >
                                        <span class="flex items-center gap-0.5">
                                            <Eye class="h-3 w-3" />
                                            {formatNumber(post.view_count)}
                                        </span>
                                        <span class="w-14 text-right">
                                            {formatRelativeTime(post.created_at)}
                                        </span>
                                    </span>
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            {:else}
                <!-- 댓글 목록 -->
                {#if filteredComments.length === 0}
                    <div class="text-muted-foreground py-16 text-center">
                        <p class="text-sm">표시할 댓글이 없습니다.</p>
                    </div>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each filteredComments as comment (comment.board + '-' + comment.id)}
                            <li>
                                <a
                                    href={comment.url}
                                    class="hover:bg-muted block px-4 py-2.5 transition-all duration-200 ease-out"
                                >
                                    <div class="flex items-start gap-2.5">
                                        <!-- 추천수 배지 -->
                                        <span
                                            class="mt-0.5 inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                                                comment.recommend_count
                                            )}"
                                        >
                                            {formatNumber(comment.recommend_count)}
                                        </span>
                                        <div class="min-w-0 flex-1">
                                            <!-- 원본 글 제목 -->
                                            <p
                                                class="text-muted-foreground flex items-center gap-1.5 truncate text-xs"
                                                title={comment.parent_title}
                                            >
                                                <span
                                                    class="bg-muted shrink-0 rounded px-1 py-0.5 text-[10px]"
                                                >
                                                    {comment.board_name}
                                                </span>
                                                <span class="truncate">{comment.parent_title}</span>
                                            </p>
                                            <!-- 댓글 내용 -->
                                            <p
                                                class="mt-0.5 line-clamp-2 text-sm leading-relaxed"
                                                style="font-size: var(--list-font-size, 1rem)"
                                            >
                                                {stripHtml(comment.content)}
                                            </p>
                                            <!-- 시간 -->
                                            <span class="text-muted-foreground mt-1 text-xs">
                                                {formatRelativeTime(comment.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            {/if}
        </CardContent>
    </Card>

    <div class="mt-6">
        <AdSlot position="explore-bottom" height="90px" slotKey="explore-bottom" />
    </div>
</div>
