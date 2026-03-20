<script lang="ts">
    import { onMount } from 'svelte';
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

    let activeMode = $state<ExploreMode>('hot');
    let topPeriod = $state<ExploreTopPeriod>('24h');
    let viewMode = $state<'posts' | 'comments'>('posts');
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
        { id: '24h', label: '24시간' },
        { id: '7d', label: '7일' },
        { id: '30d', label: '30일' }
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
        meta: { title: '톺아보기', description: '다모앙 전체 게시판 통합 피드' },
        og: { title: '톺아보기 - 다모앙', type: 'website' }
    }}
/>

<div class="mx-auto max-w-4xl px-4 py-6">
    <div class="mb-4">
        <TagNav />
    </div>

    <div class="mb-4">
        <AdSlot position="explore-top" height="90px" slotKey="explore-top" />
    </div>

    <Card class="gap-0">
        <CardHeader class="space-y-0 pb-0">
            <!-- 헤더 + 탭 한 줄 -->
            <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                    <Compass class="text-primary h-5 w-5" />
                    <h1 class="text-foreground text-lg font-bold">톺아보기</h1>
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
                            onclick={() => (activeMode = mode.id)}
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
                        onclick={() => (activeMode = mode.id)}
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
                            onclick={() => (topPeriod = period.id)}
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

            <!-- 글/댓글 토글 -->
            {#if hasComments}
                <div class="mt-3 flex gap-1">
                    <button
                        type="button"
                        class="rounded-md px-3 py-1 text-sm font-medium transition-all {viewMode ===
                        'posts'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        onclick={() => (viewMode = 'posts')}
                    >
                        글
                    </button>
                    <button
                        type="button"
                        class="rounded-md px-3 py-1 text-sm font-medium transition-all {viewMode ===
                        'comments'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                        onclick={() => (viewMode = 'comments')}
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
                {#if currentPosts.length === 0}
                    <div class="text-muted-foreground py-16 text-center">
                        <p class="text-sm">표시할 글이 없습니다.</p>
                    </div>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each currentPosts as post (post.board + '-' + post.id)}
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
                {#if currentComments.length === 0}
                    <div class="text-muted-foreground py-16 text-center">
                        <p class="text-sm">표시할 댓글이 없습니다.</p>
                    </div>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each currentComments as comment (comment.board + '-' + comment.id)}
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
                                                style="font-size: var(--list-font-size, 0.9rem)"
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
