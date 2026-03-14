<script lang="ts">
    import { SeoHead } from '$lib/seo/index.js';
    import Compass from '@lucide/svelte/icons/compass';
    import Flame from '@lucide/svelte/icons/flame';
    import Clock from '@lucide/svelte/icons/clock';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import Crown from '@lucide/svelte/icons/crown';
    import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Eye from '@lucide/svelte/icons/eye';
    import type { PageData } from './$types';
    import type { ExploreMode, ExploreTopPeriod, ExplorePost } from '$lib/api/types.js';

    let { data }: { data: PageData } = $props();

    let activeMode = $state<ExploreMode>('hot');
    let topPeriod = $state<ExploreTopPeriod>('24h');

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

    function formatNumber(n: number): string {
        if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}천`;
        return n.toString();
    }
</script>

<SeoHead
    config={{
        meta: { title: '톺아보기', description: '다모앙 전체 게시판 통합 피드' },
        og: { title: '톺아보기 - 다모앙', type: 'website' }
    }}
/>

<div class="mx-auto max-w-5xl px-4 py-8">
    <!-- 헤더 -->
    <div class="mb-6 flex items-center gap-3">
        <Compass class="text-primary h-7 w-7" />
        <div>
            <h1 class="text-foreground text-2xl font-bold">톺아보기</h1>
            {#if data.exploreData}
                <p class="text-muted-foreground text-sm">
                    {data.exploreData.board_count}개 게시판 · {data.exploreData.total_posts.toLocaleString()}개
                    글
                </p>
            {/if}
        </div>
    </div>

    <!-- 모드 탭 -->
    <div class="border-border mb-4 flex gap-1 border-b">
        {#each modes as mode (mode.id)}
            <button
                onclick={() => (activeMode = mode.id)}
                class="flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors {activeMode ===
                mode.id
                    ? 'border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground border-transparent'}"
            >
                <mode.icon class="h-4 w-4" />
                {mode.label}
            </button>
        {/each}
    </div>

    <!-- 인기 탭: 기간 하위 탭 -->
    {#if activeMode === 'top'}
        <div class="mb-4 flex gap-1">
            {#each topPeriods as period (period.id)}
                <button
                    onclick={() => (topPeriod = period.id)}
                    class="rounded-md px-3 py-1.5 text-sm transition-colors {topPeriod === period.id
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
                >
                    {period.label}
                </button>
            {/each}
        </div>
    {/if}

    <!-- 글 목록 -->
    {#if !data.exploreData}
        <div class="text-muted-foreground py-12 text-center">
            <p>데이터를 불러올 수 없습니다.</p>
        </div>
    {:else if currentPosts.length === 0}
        <div class="text-muted-foreground py-12 text-center">
            <p>표시할 글이 없습니다.</p>
        </div>
    {:else}
        <ul class="divide-border divide-y">
            {#each currentPosts as post, i (post.board + '-' + post.id)}
                <li>
                    <a
                        href={post.url}
                        class="hover:bg-muted flex items-start gap-3 rounded px-2 py-2.5 transition-colors sm:items-center"
                    >
                        <!-- 순위 (모바일 숨김) -->
                        <span
                            class="text-muted-foreground hidden w-6 shrink-0 text-right text-xs font-medium sm:block"
                        >
                            {i + 1}
                        </span>

                        <!-- 메인 콘텐츠 -->
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-1.5">
                                <!-- 게시판 뱃지 -->
                                <span
                                    class="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-xs"
                                >
                                    {post.board_name}
                                </span>
                                <!-- 제목 -->
                                <span class="text-foreground min-w-0 truncate text-sm">
                                    {post.title}
                                </span>
                                {#if post.comment_count > 0}
                                    <span class="text-primary shrink-0 text-xs"
                                        >[{post.comment_count}]</span
                                    >
                                {/if}
                            </div>

                            <!-- 메타 (모바일) -->
                            <div
                                class="text-muted-foreground mt-1 flex items-center gap-3 text-xs sm:hidden"
                            >
                                {#if post.recommend_count > 0}
                                    <span class="text-primary flex items-center gap-0.5">
                                        <ThumbsUp class="h-3 w-3" />
                                        {formatNumber(post.recommend_count)}
                                    </span>
                                {/if}
                                <span class="flex items-center gap-0.5">
                                    <Eye class="h-3 w-3" />
                                    {formatNumber(post.view_count)}
                                </span>
                                <span>{formatRelativeTime(post.created_at)}</span>
                            </div>
                        </div>

                        <!-- 메타 (데스크탑) -->
                        <div
                            class="text-muted-foreground hidden shrink-0 items-center gap-3 text-xs sm:flex"
                        >
                            {#if post.recommend_count > 0}
                                <span class="text-primary flex items-center gap-0.5">
                                    <ThumbsUp class="h-3 w-3" />
                                    {formatNumber(post.recommend_count)}
                                </span>
                            {/if}
                            {#if post.comment_count > 0}
                                <span class="flex items-center gap-0.5">
                                    <MessageSquare class="h-3 w-3" />
                                    {post.comment_count}
                                </span>
                            {/if}
                            <span class="flex items-center gap-0.5">
                                <Eye class="h-3 w-3" />
                                {formatNumber(post.view_count)}
                            </span>
                            <span class="w-16 text-right">
                                {formatRelativeTime(post.created_at)}
                            </span>
                        </div>
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</div>
