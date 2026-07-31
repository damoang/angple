<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader } from '$lib/components/ui/card/index.js';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Select from '$lib/components/ui/select/index.js';
    import { browser } from '$app/environment';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Eye from '@lucide/svelte/icons/eye';
    import FeedSkeleton from '$lib/components/features/feed/feed-skeleton.svelte';
    import { formatCommentCountBadge } from '$lib/utils/comment-count.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    // 글/댓글 — 「만」을 뺐다. 세그먼트 자체가 배타 선택을 표현하고, 모바일 폭도 아낀다.
    const viewOptions = [
        { value: '', label: '전체' },
        { value: 'w', label: '글' },
        { value: 'c', label: '댓글' }
    ];
    /**
     * 범위 — 자유게시판이 새글모음의 89.8%(7일 실측)라 목록의 게시판 이름이 30행 중 27행이
     * 같은 값이 된다. 이 칩을 눌러야 "다른 게시판에서 무슨 일이 있나"가 비로소 보인다.
     * ⛔ 값은 서버 `FEED_SCOPE_PRESETS` 와 같은 집합이어야 한다.
     */
    const scopeOptions = [
        { value: '', label: '전체' },
        { value: 'nofree', label: '자유게시판 제외' }
    ];
    const sortOptions = [
        { value: 'latest', label: '최신순' },
        { value: 'comments', label: '댓글순' },
        { value: 'views', label: '조회순' }
    ];

    let showAdvanced = $state(false);

    const hasActiveFilter = $derived(
        Boolean(data.currentView || data.currentScope || data.currentGroup)
    );

    /** 빈 목록에서 빠져나오는 길. 기억한 값도 함께 지운다 — 안 그러면 다음 방문에 되돌아온다. */
    function resetFilters(): void {
        savePrefs({ view: '', scope: '' });
        goto('/feed');
    }

    const scopeLabel = $derived(
        scopeOptions.find((o) => o.value === data.currentScope)?.label || '전체'
    );

    const selectedGroupLabel = $derived(
        data.currentGroup
            ? data.groups.find((g) => g.gr_id === data.currentGroup)?.gr_subject ||
                  data.currentGroup
            : '전체 그룹'
    );
    const selectedSortLabel = $derived(
        sortOptions.find((o) => o.value === data.currentSort)?.label || '최신순'
    );

    /**
     * 보기 설정 기억.
     *
     * ⛔ 쿠키로 하면 안 된다 — 이 응답에는 `Cache-Control: public, s-maxage=10` 이 붙어 있어
     *    쿠키로 응답을 가르면 공유 캐시가 남의 취향을 서빙한다. 서버는 이 선호를 몰라야 한다.
     * 실측 근거: `view=w` 가 `page=1` 과 함께 반복 등장 = 매 방문 다시 고르고 있었다.
     */
    const PREFS_KEY = 'angple_feed_prefs';
    let prefsRestored = false;

    function savePrefs(patch: { view?: string; scope?: string }): void {
        if (!browser) return;
        try {
            const cur = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
            localStorage.setItem(PREFS_KEY, JSON.stringify({ ...cur, ...patch }));
        } catch {
            // 저장 실패는 무시 — 기억이 안 될 뿐 화면은 정상이다
        }
    }

    $effect(() => {
        if (!browser || prefsRestored) return;
        prefsRestored = true;

        // ⛔ 쿼리스트링이 **하나라도** 있으면 복원하지 않는다.
        //    `?view=c` 같은 공유 링크가 개인 설정에 덮이면 안 된다. URL 이 항상 이긴다.
        if (window.location.search) return;

        let saved: { view?: string; scope?: string };
        try {
            saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        } catch {
            return;
        }

        const params = new URLSearchParams();
        // 기본값('')은 파라미터 부재로 표현되므로 truthy 인 것만 복원한다 —
        // "전체를 골랐는데 다시 글만으로 튕기는" 되돌이가 이 조건에서 자연히 끊긴다.
        if (saved.view && viewOptions.some((o) => o.value === saved.view)) {
            params.set('view', saved.view);
        }
        if (saved.scope && scopeOptions.some((o) => o.value === saved.scope)) {
            params.set('scope', saved.scope);
        }
        if ([...params].length === 0) return;

        goto(`${window.location.pathname}?${params}`, { replaceState: true });
    });

    // 필터 변경
    function updateFilter(key: string, value: string): void {
        if (key === 'view' || key === 'scope') savePrefs({ [key]: value });
        const url = new URL(window.location.href);
        if (value) {
            url.searchParams.set(key, value);
        } else {
            url.searchParams.delete(key);
        }
        url.searchParams.set('page', '1');
        url.searchParams.delete('cursor');
        goto(url.pathname + url.search);
    }

    // 페이지 이동 (커서 기반)
    function goToPage(pageNum: number, nextCursor?: number | null): void {
        const url = new URL(window.location.href);
        url.searchParams.set('page', String(pageNum));
        if (data.currentSort === 'latest' && nextCursor && pageNum > data.page) {
            url.searchParams.set('cursor', String(nextCursor));
        } else {
            url.searchParams.delete('cursor');
        }
        goto(url.pathname + url.search);
    }

    // 시간 포맷
    function formatTime(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (targetDate.getTime() === today.getTime()) {
            return date.toLocaleTimeString('ko-KR', {
                timeZone: 'Asia/Seoul',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } else {
            return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
        }
    }

    // 댓글인지 여부
    function isComment(item: { wr_id: number; wr_parent: number }): boolean {
        return item.wr_id !== item.wr_parent;
    }
</script>

<svelte:head>
    <!-- ⛔ '새글' 고정. '새글 모아보기'는 옆 메뉴 '모아보기'(/explore)와 헷갈린다. -->
    <title>새글 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
    <meta
        name="description"
        content="{import.meta.env.VITE_SITE_NAME ||
            'Angple'} 커뮤니티 최신 글과 댓글을 한눈에 확인하세요."
    />
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <div class="mb-4">
        <AdSlot position="feed-top" height="90px" slotKey="feed-top" />
    </div>

    {#await data.streamed?.posts}
        <!-- 스켈레톤 (데이터 로딩 중) -->
        <FeedSkeleton />
    {:then result}
        <!-- 게시글 목록 카드 -->
        <Card class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
            <!-- 카드 헤더 -->
            <CardHeader class="border-border border-b px-4 py-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    <!-- 타이틀 -->
                    <div class="flex items-center gap-3">
                        <div
                            class="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg"
                        >
                            <Newspaper class="text-primary h-5 w-5" />
                        </div>
                        <div>
                            <h1 class="text-foreground text-xl font-bold leading-tight">새글</h1>
                            <p class="text-muted-foreground text-sm">
                                {scopeLabel}
                                {result.total.toLocaleString()}건
                            </p>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        class="text-muted-foreground h-9 gap-1.5 text-sm"
                        aria-expanded={showAdvanced}
                        onclick={() => (showAdvanced = !showAdvanced)}
                    >
                        <SlidersHorizontal class="h-4 w-4" />
                        {showAdvanced ? '접기' : '자세한 조건'}
                    </Button>
                </div>

                <!--
                    글/댓글(콘텐츠 종류)과 범위(출처)는 직교하는 축이다.
                    같은 모양을 쓰면 상하 관계로 오해되므로 세그먼트 ↔ 칩으로 모양을 달리한다.
                    각 그룹을 자기 div 로 감싸 wrap 이 **그룹 단위**로 일어나게 한다
                    (칩이 낱개로 흩어지면 어느 축인지 알 수 없다).
                -->
                <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <!--
                        ⛔ Tabs 컴포넌트를 쓰지 않는다. 이건 패널 전환이 아니라 **내비게이션**이다.
                           role="tab" 은 "누르면 tabpanel 이 바뀐다"고 알리는데 여기엔 패널이 없어
                           보조기기에 거짓을 말하게 된다. 모양만 세그먼트로 하고 의미는 버튼으로 둔다.
                    -->
                    <div
                        role="group"
                        aria-label="글과 댓글 중 볼 항목"
                        class="bg-muted flex h-9 items-center gap-0.5 rounded-lg p-0.5"
                    >
                        {#each viewOptions as opt (opt.value)}
                            <button
                                type="button"
                                aria-pressed={data.currentView === opt.value}
                                class="rounded-md px-3 py-1 text-sm transition-colors {data.currentView ===
                                opt.value
                                    ? 'bg-background text-foreground font-medium shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'}"
                                onclick={() => updateFilter('view', opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>

                    <div class="flex items-center gap-1">
                        {#each scopeOptions as opt (opt.value)}
                            <button
                                type="button"
                                aria-pressed={data.currentScope === opt.value}
                                class="rounded-md px-2.5 py-1.5 text-sm transition-colors {data.currentScope ===
                                opt.value
                                    ? 'bg-accent text-accent-foreground font-medium'
                                    : 'text-muted-foreground hover:bg-muted'}"
                                onclick={() => updateFilter('scope', opt.value)}
                            >
                                {opt.label}
                            </button>
                        {/each}
                    </div>
                </div>

                <!--
                    정렬·그룹은 실측 사용 0회라 접어 둔다. **지우지는 않는다** —
                    "안 쓴다"가 "없애도 된다"는 아니고, 되돌리기가 {#if} 제거뿐이어야 한다.
                -->
                {#if showAdvanced}
                    <div class="border-border mt-3 flex flex-wrap gap-2 border-t pt-3">
                        <Select.Root
                            type="single"
                            value={data.currentSort}
                            onValueChange={(v) => updateFilter('sort', v || 'latest')}
                        >
                            <Select.Trigger class="h-9 w-[110px] text-sm"
                                >{selectedSortLabel}</Select.Trigger
                            >
                            <Select.Content>
                                {#each sortOptions as opt (opt.value)}
                                    <Select.Item value={opt.value}>{opt.label}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>

                        <Select.Root
                            type="single"
                            value={data.currentGroup}
                            onValueChange={(v) => updateFilter('gr_id', v || '')}
                        >
                            <Select.Trigger class="h-9 w-[140px] text-sm"
                                >{selectedGroupLabel}</Select.Trigger
                            >
                            <Select.Content>
                                <Select.Item value="">전체 그룹</Select.Item>
                                {#each data.groups as group (group.gr_id)}
                                    <Select.Item value={group.gr_id}>{group.gr_subject}</Select.Item
                                    >
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </div>
                {/if}
            </CardHeader>

            <!-- 목록 -->
            <CardContent class="p-0">
                {#if result.items.length === 0}
                    <div class="py-16 text-center">
                        <div
                            class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                        >
                            <Newspaper class="text-muted-foreground h-8 w-8" />
                        </div>
                        {#if hasActiveFilter}
                            <!-- 필터 때문에 빈 것을 "글이 없다"고 하면 거짓말이 된다 -->
                            <p class="text-foreground mb-1 text-lg font-medium">
                                선택하신 조건에 해당하는 새 글이 없습니다
                            </p>
                            <p class="text-muted-foreground mb-4 text-sm">
                                조건을 바꾸어 다시 확인해 보세요.
                            </p>
                            <Button variant="outline" size="sm" onclick={resetFilters}>
                                전체 보기
                            </Button>
                        {:else}
                            <p class="text-foreground mb-1 text-lg font-medium">
                                최근 7일 동안 올라온 새 글이 없습니다
                            </p>
                        {/if}
                    </div>
                {:else}
                    <div class="divide-border divide-y">
                        {#each result.items as item (item.bn_id)}
                            <a
                                href={isComment(item)
                                    ? `/${item.bo_table}/${item.wr_parent}#c_${item.wr_id}`
                                    : `/${item.bo_table}/${item.wr_id}`}
                                class="hover:bg-muted/50 block px-4 py-2.5 no-underline transition-all duration-200"
                            >
                                <div class="flex items-center gap-2 md:gap-3">
                                    <div class="hidden shrink-0 md:block">
                                        <span
                                            class="bg-muted text-muted-foreground inline-flex h-7 w-16 items-center justify-center rounded-lg text-xs font-medium"
                                        >
                                            {item.bo_subject}
                                        </span>
                                    </div>

                                    <div class="min-w-0 flex-1">
                                        <div
                                            class="flex flex-col gap-1 md:flex-row md:items-center md:gap-3"
                                        >
                                            <div class="flex min-w-0 flex-1 items-center gap-1.5">
                                                {#if isComment(item)}
                                                    <span
                                                        class="bg-muted flex h-5 w-5 shrink-0 items-center justify-center rounded"
                                                    >
                                                        <MessageSquare
                                                            class="text-muted-foreground h-3 w-3"
                                                        />
                                                    </span>
                                                    <span
                                                        class="text-muted-foreground truncate text-[15px] leading-relaxed"
                                                    >
                                                        {item.wr_content || item.wr_subject}
                                                    </span>
                                                {:else}
                                                    <span
                                                        class="text-foreground truncate text-[15px] font-medium leading-relaxed"
                                                    >
                                                        {item.wr_subject}
                                                    </span>
                                                    {#if item.wr_comment > 0}
                                                        <span
                                                            class="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                                                        >
                                                            {formatCommentCountBadge(
                                                                item.wr_comment
                                                            )}
                                                        </span>
                                                    {/if}
                                                {/if}
                                            </div>

                                            <div class="hidden shrink-0 items-center gap-2 md:flex">
                                                <span
                                                    class="text-muted-foreground w-[100px] truncate text-sm"
                                                >
                                                    {item.wr_name}
                                                </span>
                                                <span
                                                    class="text-muted-foreground w-[65px] text-center text-sm"
                                                >
                                                    {formatTime(item.bn_datetime)}
                                                </span>
                                                <span
                                                    class="text-muted-foreground flex w-[50px] items-center justify-end gap-1 text-sm"
                                                >
                                                    <Eye class="h-3.5 w-3.5" />
                                                    {item.wr_hit.toLocaleString()}
                                                </span>
                                            </div>

                                            <div
                                                class="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm md:hidden"
                                            >
                                                <span
                                                    class="bg-muted rounded px-1.5 py-0.5 text-xs font-medium"
                                                >
                                                    {item.bo_subject}
                                                </span>
                                                <span>{item.wr_name}</span>
                                                <span class="text-border">·</span>
                                                <span>{formatTime(item.bn_datetime)}</span>
                                                {#if !isComment(item) && item.wr_hit > 0}
                                                    <span class="text-border">·</span>
                                                    <span class="flex items-center gap-0.5">
                                                        <Eye class="h-3 w-3" />
                                                        {item.wr_hit.toLocaleString()}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}
            </CardContent>
        </Card>

        <!-- 페이지네이션 -->
        {@const totalPages = Math.ceil(result.total / data.perPage)}
        {#if totalPages > 1}
            <div class="mt-6 flex items-center justify-center gap-1.5">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                    class="h-9 px-3 transition-all duration-200"
                >
                    이전
                </Button>

                {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const startPage = Math.max(1, data.page - 2);
                    return startPage + i;
                }) as pageNum (pageNum)}
                    {#if pageNum <= totalPages}
                        <Button
                            variant={pageNum === data.page ? 'default' : 'outline'}
                            size="sm"
                            onclick={() =>
                                goToPage(pageNum, pageNum > data.page ? result.nextCursor : null)}
                            class="h-9 w-9 p-0 transition-all duration-200"
                        >
                            {pageNum}
                        </Button>
                    {/if}
                {/each}

                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === totalPages}
                    onclick={() => goToPage(data.page + 1, result.nextCursor)}
                    class="h-9 px-3 transition-all duration-200"
                >
                    다음
                </Button>
            </div>

            <p class="text-muted-foreground mt-3 text-center text-sm">
                {data.page} / {totalPages} 페이지
            </p>
        {/if}
    {:catch}
        <!-- 에러 상태 -->
        <Card class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
            <CardContent class="py-16 text-center">
                <div
                    class="bg-muted mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                >
                    <Newspaper class="text-muted-foreground h-8 w-8" />
                </div>
                <p class="text-foreground mb-1 text-lg font-medium">데이터를 불러올 수 없습니다</p>
                <p class="text-muted-foreground text-sm">잠시 후 다시 시도해주세요.</p>
            </CardContent>
        </Card>
    {/await}
</div>
