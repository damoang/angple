<script lang="ts">
    // import { onMount } from 'svelte';
    import { SeoHead } from '$lib/seo/index.js';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import Users from '@lucide/svelte/icons/users';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import FileText from '@lucide/svelte/icons/file-text';
    import Clock from '@lucide/svelte/icons/clock';
    import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
    import Flame from '@lucide/svelte/icons/flame';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import { formatDate } from '$lib/utils/format-date.js';
    import { formatCommentCountBadge } from '$lib/utils/comment-count.js';
    // import { Skeleton } from '$lib/components/ui/skeleton/index.js';
    import type { PageData } from './$types';
    import type { GroupLatestPost } from './+page.server.js';

    let { data }: { data: PageData } = $props();

    let searchQuery = $state('');
    let activeTab = $state<'latest' | 'popular' | 'list'>('latest');
    let activityFilter = $state<'all' | 'today' | 'week'>('all');
    let sortBy = $state<'activity' | 'subscribers' | 'posts' | 'comments' | 'name'>('activity');

    let filteredBoards = $derived(
        data.boards
            .filter((board) => {
                const matchesQuery = searchQuery
                    ? board.bo_subject.toLowerCase().includes(searchQuery.toLowerCase())
                    : true;

                const matchesActivity =
                    activityFilter === 'today'
                        ? board.today_count > 0
                        : activityFilter === 'week'
                          ? board.weekly_count > 0
                          : true;

                return matchesQuery && matchesActivity;
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case 'subscribers':
                        return (
                            b.subscriber_count - a.subscriber_count ||
                            b.weekly_count - a.weekly_count ||
                            a.bo_subject.localeCompare(b.bo_subject, 'ko')
                        );
                    case 'posts':
                        return (
                            b.bo_count_write - a.bo_count_write ||
                            b.weekly_count - a.weekly_count ||
                            a.bo_subject.localeCompare(b.bo_subject, 'ko')
                        );
                    case 'comments':
                        return (
                            b.bo_count_comment - a.bo_count_comment ||
                            b.weekly_count - a.weekly_count ||
                            a.bo_subject.localeCompare(b.bo_subject, 'ko')
                        );
                    case 'name':
                        return a.bo_subject.localeCompare(b.bo_subject, 'ko');
                    case 'activity':
                    default:
                        return (
                            b.today_count - a.today_count ||
                            b.weekly_count - a.weekly_count ||
                            b.subscriber_count - a.subscriber_count ||
                            a.bo_subject.localeCompare(b.bo_subject, 'ko')
                        );
                }
            })
    );

    // SSR 데이터만 표시 (무한 스크롤 비활성화)
    let latestPosts = $state<GroupLatestPost[]>(data.latestPosts);

    // -- 무한 스크롤 비활성화 --
    // let currentPage = $state(1);
    // let hasMore = $state(data.latestHasMore);
    // let isLoadingMore = $state(false);
    // let loadError = $state(false);
    // let sentinel: HTMLDivElement | undefined = $state();
    //
    // async function loadMore() {
    //     if (isLoadingMore || !hasMore) return;
    //     isLoadingMore = true;
    //     loadError = false;
    //
    //     try {
    //         const nextPage = currentPage + 1;
    //         const res = await fetch(`/api/groups/latest?page=${nextPage}&limit=20`);
    //         if (!res.ok) throw new Error(`HTTP ${res.status}`);
    //         const result: { items: GroupLatestPost[]; total: number; hasMore: boolean } =
    //             await res.json();
    //
    //         latestPosts = [...latestPosts, ...result.items];
    //         hasMore = result.hasMore;
    //         currentPage = nextPage;
    //     } catch {
    //         loadError = true;
    //     } finally {
    //         isLoadingMore = false;
    //     }
    // }
    //
    // // IntersectionObserver
    // onMount(() => {
    //     if (!sentinel) return;
    //     const observer = new IntersectionObserver(
    //         (entries) => {
    //             if (entries[0]?.isIntersecting && activeTab === 'latest') {
    //                 loadMore();
    //             }
    //         },
    //         { rootMargin: '200px' }
    //     );
    //     observer.observe(sentinel);
    //     return () => observer.disconnect();
    // });
</script>

<SeoHead
    config={{
        meta: { title: '소모임 전체 목록', description: '다모앙 소모임 게시판 전체 목록' },
        og: { title: '소모임 전체 목록', type: 'website' }
    }}
/>

<div class="mx-auto max-w-5xl px-4 py-8">
    <Card class="gap-0">
        <CardHeader class="space-y-0 pb-0">
            <!-- 헤더 -->
            <div class="mb-4 flex items-center gap-3">
                <Users class="text-primary h-7 w-7" />
                <div>
                    <h1 class="text-foreground text-2xl font-bold">소모임 전체 목록</h1>
                    <p class="text-muted-foreground text-sm">
                        총 {data.boards.length}개의 소모임이 운영 중입니다
                    </p>
                </div>
            </div>

            <!-- 탭 -->
            <div class="border-border flex gap-1 border-b">
                <button
                    onclick={() => (activeTab = 'latest')}
                    class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab ===
                    'latest'
                        ? 'border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground border-transparent'}"
                >
                    최근글
                </button>
                <button
                    onclick={() => (activeTab = 'popular')}
                    class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab ===
                    'popular'
                        ? 'border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground border-transparent'}"
                >
                    추천글
                </button>
                <button
                    onclick={() => (activeTab = 'list')}
                    class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab ===
                    'list'
                        ? 'border-primary text-primary'
                        : 'text-muted-foreground hover:text-foreground border-transparent'}"
                >
                    소모임 목록
                </button>
            </div>
        </CardHeader>

        <CardContent class="px-0 pb-0">
            <div class="px-6 pt-4">
                <AdSlot position="groups-top" height="90px" slotKey="groups-top" />
            </div>

            {#if activeTab === 'list'}
                <div class="space-y-3 px-6 pt-4">
                    <div class="flex flex-col gap-2 md:flex-row">
                        <input
                            type="text"
                            placeholder="소모임 검색..."
                            class="border-border bg-canvas text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-1"
                            bind:value={searchQuery}
                        />
                        <select
                            class="border-border bg-background text-foreground h-10 rounded-lg border px-3 text-sm outline-none"
                            bind:value={sortBy}
                        >
                            <option value="activity">활동순</option>
                            <option value="subscribers">구독순</option>
                            <option value="posts">글 많은 순</option>
                            <option value="comments">댓글 많은 순</option>
                            <option value="name">이름순</option>
                        </select>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="rounded-full px-3 py-1.5 text-xs font-medium transition-all {activityFilter ===
                            'all'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground'}"
                            onclick={() => (activityFilter = 'all')}
                        >
                            전체
                        </button>
                        <button
                            type="button"
                            class="rounded-full px-3 py-1.5 text-xs font-medium transition-all {activityFilter ===
                            'today'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground'}"
                            onclick={() => (activityFilter = 'today')}
                        >
                            오늘 글 있음
                        </button>
                        <button
                            type="button"
                            class="rounded-full px-3 py-1.5 text-xs font-medium transition-all {activityFilter ===
                            'week'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground'}"
                            onclick={() => (activityFilter = 'week')}
                        >
                            이번 주 활동
                        </button>
                    </div>
                </div>

                <!-- 소모임 그리드 -->
                {#if filteredBoards.length === 0}
                    <div class="text-muted-foreground py-12 text-center">
                        {#if searchQuery}
                            <p>'{searchQuery}'에 해당하는 소모임이 없습니다.</p>
                        {:else}
                            <p>소모임 목록을 불러올 수 없습니다.</p>
                        {/if}
                    </div>
                {:else}
                    <div
                        class="grid grid-cols-1 gap-3 px-6 pb-4 pt-3 sm:grid-cols-2 lg:grid-cols-3"
                    >
                        {#each filteredBoards as board (board.bo_table)}
                            <a
                                href="/{board.bo_table}"
                                class="border-border hover:border-primary/40 bg-canvas flex items-center gap-3 rounded-lg border p-4 transition-all hover:shadow-sm"
                            >
                                <div
                                    class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                                >
                                    <Users class="h-5 w-5" />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <h2
                                        class="text-foreground flex items-center gap-1.5 truncate text-sm font-semibold"
                                    >
                                        <span class="truncate">{board.bo_subject}</span>
                                        {#if board.today_count > 0}
                                            <span class="text-primary shrink-0 text-xs font-normal"
                                                >(+{board.today_count})</span
                                            >
                                        {/if}
                                    </h2>
                                    <div
                                        class="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3 text-xs"
                                    >
                                        <span class="flex items-center gap-1">
                                            <Users class="h-3 w-3" />
                                            {board.subscriber_count.toLocaleString()}
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <Flame class="h-3 w-3" />
                                            주간 {board.weekly_count.toLocaleString()}
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <FileText class="h-3 w-3" />
                                            {board.bo_count_write.toLocaleString()}
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <MessageSquare class="h-3 w-3" />
                                            {board.bo_count_comment.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}
            {:else if activeTab === 'popular'}
                <!-- 추천글 탭 -->
                {#if !data.popularPosts || data.popularPosts.length === 0}
                    <div class="text-muted-foreground py-12 text-center">
                        <p>최근 7일간 추천받은 글이 없습니다.</p>
                    </div>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each data.popularPosts as post (post.bo_table + '-' + post.wr_id)}
                            <li>
                                <a
                                    href="/{post.bo_table}/{post.wr_id}"
                                    class="hover:bg-muted flex items-center gap-2 rounded px-2 py-1.5 transition-colors"
                                >
                                    <span
                                        class="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-xs"
                                    >
                                        {post.bo_subject}
                                    </span>
                                    <span class="text-foreground min-w-0 truncate text-sm">
                                        {post.wr_subject}
                                    </span>
                                    {#if post.wr_comment > 0}
                                        <span class="text-primary shrink-0 text-xs"
                                            >{formatCommentCountBadge(post.wr_comment)}</span
                                        >
                                    {/if}
                                    <span
                                        class="text-muted-foreground ml-auto flex shrink-0 items-center gap-2 text-xs"
                                    >
                                        {#if post.wr_good > 0}
                                            <span class="text-primary flex items-center gap-0.5">
                                                <ThumbsUp class="h-3 w-3" />
                                                {post.wr_good}
                                            </span>
                                        {/if}
                                        <span>{post.mb_nick}</span>
                                        <span class="hidden items-center gap-0.5 sm:flex">
                                            <Clock class="h-3 w-3" />
                                            {formatDate(post.wr_datetime)}
                                        </span>
                                    </span>
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            {:else}
                <!-- 최근글 탭 -->
                {#if latestPosts.length === 0}
                    <div class="text-muted-foreground py-12 text-center">
                        <p>최근 작성된 글이 없습니다.</p>
                    </div>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each latestPosts as post (post.bo_table + '-' + post.wr_id)}
                            <li>
                                <a
                                    href="/{post.bo_table}/{post.wr_id}"
                                    class="hover:bg-muted flex items-center gap-2 rounded px-2 py-1.5 transition-colors"
                                >
                                    <span
                                        class="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-xs"
                                    >
                                        {post.bo_subject}
                                    </span>
                                    <span class="text-foreground min-w-0 truncate text-sm">
                                        {post.wr_subject}
                                    </span>
                                    {#if post.wr_comment > 0}
                                        <span class="text-primary shrink-0 text-xs"
                                            >{formatCommentCountBadge(post.wr_comment)}</span
                                        >
                                    {/if}
                                    <span
                                        class="text-muted-foreground ml-auto flex shrink-0 items-center gap-2 text-xs"
                                    >
                                        <span>{post.mb_nick}</span>
                                        <span class="hidden items-center gap-0.5 sm:flex">
                                            <Clock class="h-3 w-3" />
                                            {formatDate(post.wr_datetime)}
                                        </span>
                                        {#if post.wr_good > 0}
                                            <span>👍 {post.wr_good}</span>
                                        {/if}
                                    </span>
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            {/if}
        </CardContent>
    </Card>

    <!-- 소모임 개설 안내 -->
    <div class="border-border bg-muted/30 mt-8 rounded-lg border p-4 text-center">
        <p class="text-muted-foreground text-sm">
            새로운 소모임을 개설하고 싶으신가요?
            <a href="/newgroup" class="text-primary font-medium hover:underline">소모임 개설 신청</a
            >
        </p>
    </div>
</div>
