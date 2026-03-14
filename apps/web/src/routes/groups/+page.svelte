<script lang="ts">
    // import { onMount } from 'svelte';
    import { SeoHead } from '$lib/seo/index.js';
    import Users from '@lucide/svelte/icons/users';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import FileText from '@lucide/svelte/icons/file-text';
    import Clock from '@lucide/svelte/icons/clock';
    import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
    import { formatDate } from '$lib/utils/format-date.js';
    // import { Skeleton } from '$lib/components/ui/skeleton/index.js';
    import type { PageData } from './$types';
    import type { GroupLatestPost } from './+page.server.js';

    let { data }: { data: PageData } = $props();

    let searchQuery = $state('');
    let activeTab = $state<'latest' | 'popular' | 'list'>('latest');

    let filteredBoards = $derived(
        searchQuery
            ? data.boards.filter((b) =>
                  b.bo_subject.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : data.boards
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
    <!-- 헤더 -->
    <div class="mb-6 flex items-center gap-3">
        <Users class="text-primary h-7 w-7" />
        <div>
            <h1 class="text-foreground text-2xl font-bold">소모임 전체 목록</h1>
            <p class="text-muted-foreground text-sm">
                총 {data.boards.length}개의 소모임이 운영 중입니다
            </p>
        </div>
    </div>

    <!-- 탭 -->
    <div class="border-border mb-4 flex gap-1 border-b">
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
            class="border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeTab === 'list'
                ? 'border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground border-transparent'}"
        >
            소모임 목록
        </button>
    </div>

    {#if activeTab === 'list'}
        <!-- 검색 -->
        <div class="mb-6">
            <input
                type="text"
                placeholder="소모임 검색..."
                class="border-border bg-canvas text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-1"
                bind:value={searchQuery}
            />
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
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                                class="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs"
                            >
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
                                    >[{post.wr_comment}]</span
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
        <!-- 최근글 탭 (무한 스크롤) -->
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
                                    >[{post.wr_comment}]</span
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

                <!-- 무한 스크롤 비활성화: 스켈레톤, 에러, 센티넬 제거 -->
            </ul>
        {/if}
    {/if}

    <!-- 소모임 개설 안내 -->
    <div class="border-border bg-muted/30 mt-8 rounded-lg border p-4 text-center">
        <p class="text-muted-foreground text-sm">
            새로운 소모임을 개설하고 싶으신가요?
            <a href="/newgroup" class="text-primary font-medium hover:underline">소모임 개설 신청</a
            >
        </p>
    </div>
</div>
