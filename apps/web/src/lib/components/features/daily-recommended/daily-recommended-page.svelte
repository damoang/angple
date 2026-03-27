<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import type {
        DailyCalendarEntry,
        DailyRecommendedData,
        RecommendedComment,
        RecommendedPost
    } from '$lib/api/types.js';
    import { PostCard } from '$lib/components/ui/post-card';
    import CommentCard from './comment-card.svelte';
    import DateNavigator from './date-navigator.svelte';
    import SectionTabs from './section-tabs.svelte';
    import ThresholdFilter from './threshold-filter.svelte';
    import SortSelector from './sort-selector.svelte';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte.js';
    import DailyStatsBar from './daily-stats-bar.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import Compass from '@lucide/svelte/icons/compass';

    interface Props {
        date: string;
        dailyData: DailyRecommendedData | null;
        calendarDates: DailyCalendarEntry[];
        oldestDate: string;
        newestDate: string;
    }

    const { date, dailyData, calendarDates, oldestDate, newestDate }: Props = $props();

    // 폴링으로 갱신된 데이터 (오늘 데이터 자동 새로고침용)
    let pollData = $state<DailyRecommendedData | null>(null);

    // props(SSR/SPA) 또는 폴링 데이터 중 최신 사용
    const activeData = $derived(pollData ?? dailyData);
    const sections = $derived(activeData?.sections ?? null);
    const stats = $derived(activeData?.stats ?? null);
    const dateDisplay = $derived(activeData?.date_display ?? '');
    const isToday = $derived(activeData?.is_today ?? false);

    // SPA 네비게이션 시 폴링 데이터 초기화
    $effect(() => {
        date; // date 변경 추적
        pollData = null;
    });

    let viewMode = $state<'posts' | 'comments'>('posts');
    let activeTab = $state<'all' | 'community' | 'group' | 'info'>('all');
    let threshold = $state(0);
    let sortBy = $state<'recommend' | 'views' | 'comments' | 'latest'>('recommend');
    const commentSections = $derived(activeData?.comments ?? null);
    const hasComments = $derived(
        commentSections != null &&
            (commentSections.community?.count ?? 0) +
                (commentSections.group?.count ?? 0) +
                (commentSections.info?.count ?? 0) >
                0
    );

    // 필터 + 정렬 적용된 게시글 목록
    const filteredPosts = $derived.by(() => {
        if (!sections) return [];

        let posts: RecommendedPost[] = [];

        if (activeTab === 'all') {
            const all = [
                ...(sections.community.posts ?? []),
                ...(sections.group.posts ?? []),
                ...(sections.info.posts ?? [])
            ];
            // 섹션 간 중복 게시글 제거 (id+board 기준)
            const seen = new Set<string>();
            posts = all.filter((p) => {
                const key = `${p.id}-${p.board}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        } else {
            posts = [...(sections[activeTab]?.posts ?? [])];
        }

        // 차단된 사용자 글 필터
        posts = posts.filter((p) => !blockedUsersStore.isBlocked(p.author));

        // 최소 추천수 필터
        if (threshold > 0) {
            posts = posts.filter((p) => p.recommend_count >= threshold);
        }

        // 정렬
        posts.sort((a, b) => {
            switch (sortBy) {
                case 'recommend':
                    return b.recommend_count - a.recommend_count;
                case 'views':
                    return b.view_count - a.view_count;
                case 'comments':
                    return b.comment_count - a.comment_count;
                case 'latest':
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                default:
                    return 0;
            }
        });

        return posts;
    });

    // 필터 + 정렬 적용된 댓글 목록
    const filteredComments = $derived.by(() => {
        if (!commentSections) return [];

        let comments: RecommendedComment[] = [];

        if (activeTab === 'all') {
            const all = [
                ...(commentSections.community?.comments ?? []),
                ...(commentSections.group?.comments ?? []),
                ...(commentSections.info?.comments ?? [])
            ];
            const seen = new Set<string>();
            comments = all.filter((c) => {
                const key = `${c.id}-${c.board}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        } else {
            comments = [...(commentSections[activeTab]?.comments ?? [])];
        }

        // 차단된 사용자 댓글 필터
        comments = comments.filter((c) => !blockedUsersStore.isBlocked(c.author));

        if (threshold > 0) {
            comments = comments.filter((c) => c.recommend_count >= threshold);
        }

        comments.sort((a, b) => {
            if (sortBy === 'latest') {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            }
            return b.recommend_count - a.recommend_count;
        });

        return comments;
    });

    // 섹션별 수 (필터 전)
    const sectionCounts = $derived(
        viewMode === 'comments' && commentSections
            ? {
                  all:
                      (commentSections.community?.count ?? 0) +
                      (commentSections.group?.count ?? 0) +
                      (commentSections.info?.count ?? 0),
                  community: commentSections.community?.count ?? 0,
                  group: commentSections.group?.count ?? 0,
                  info: commentSections.info?.count ?? 0
              }
            : {
                  all:
                      (sections?.community.count ?? 0) +
                      (sections?.group.count ?? 0) +
                      (sections?.info.count ?? 0),
                  community: sections?.community.count ?? 0,
                  group: sections?.group.count ?? 0,
                  info: sections?.info.count ?? 0
              }
    );

    // 오늘 데이터 폴링 (5분 간격)
    let pollingTimer: ReturnType<typeof setInterval> | undefined;

    onMount(() => {
        if (isToday) {
            pollingTimer = setInterval(
                async () => {
                    try {
                        const res = await fetch(`/api/empathy?date=${date}`);
                        if (!res.ok) return;
                        pollData = await res.json();
                    } catch {
                        // 폴링 실패 무시
                    }
                },
                5 * 60 * 1000
            );
        }

        return () => {
            if (pollingTimer) clearInterval(pollingTimer);
        };
    });

    function handleDateChange(newDate: string) {
        goto(`/empathy/${newDate}`);
    }
</script>

<div class="mx-auto max-w-5xl px-4 py-4">
    <div class="mb-4">
        <AdSlot position="empathy-top" height="90px" slotKey="empathy-top" />
    </div>

    <Card class="gap-0 overflow-hidden">
        <CardHeader class="space-y-0 pb-0">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center gap-2">
                    <Compass class="text-primary h-5 w-5" />
                    <h1 class="text-foreground text-lg font-bold">날짜별 공감글</h1>
                    {#if dateDisplay}
                        <span class="text-muted-foreground text-xs">{dateDisplay}</span>
                    {/if}
                </div>
                <DateNavigator
                    currentDate={date}
                    {calendarDates}
                    {oldestDate}
                    {newestDate}
                    onDateChange={handleDateChange}
                />
            </div>

            {#if stats}
                <div class="mt-3">
                    <DailyStatsBar {stats} />
                </div>
            {/if}

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

            <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <SectionTabs bind:activeTab counts={sectionCounts} />
                <div class="flex items-center gap-2">
                    <ThresholdFilter bind:threshold />
                    {#if viewMode === 'posts'}
                        <SortSelector bind:sortBy />
                    {/if}
                </div>
            </div>
        </CardHeader>

        <CardContent class="px-0 pb-0">
            {#if !sections}
                <div class="flex flex-col items-center justify-center py-16 text-center">
                    <p class="text-muted-foreground text-lg">이 날짜의 공감글 데이터가 없습니다</p>
                    <p class="text-muted-foreground mt-1 text-sm">다른 날짜를 선택해 주세요</p>
                </div>
            {:else if viewMode === 'posts'}
                {#if filteredPosts.length > 0}
                    <ul class="divide-border divide-y">
                        {#each filteredPosts as post (post.id + '-' + post.board)}
                            <PostCard {post} />
                        {/each}
                    </ul>
                    <p class="text-muted-foreground px-4 py-3 text-center text-xs">
                        {filteredPosts.length}건 표시
                        {#if threshold > 0}
                            (추천 {threshold}+ 필터 적용)
                        {/if}
                    </p>
                {:else}
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <p class="text-muted-foreground text-sm">
                            {#if threshold > 0}
                                추천 {threshold}건 이상 글이 없습니다. 필터를 낮춰보세요.
                            {:else}
                                이 섹션에 글이 없습니다.
                            {/if}
                        </p>
                    </div>
                {/if}
            {:else if filteredComments.length > 0}
                <ul class="divide-border divide-y">
                    {#each filteredComments as comment (comment.id + '-' + comment.board)}
                        <CommentCard {comment} />
                    {/each}
                </ul>
                <p class="text-muted-foreground px-4 py-3 text-center text-xs">
                    {filteredComments.length}건 표시
                    {#if threshold > 0}
                        (추천 {threshold}+ 필터 적용)
                    {/if}
                </p>
            {:else}
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <p class="text-muted-foreground text-sm">
                        {#if threshold > 0}
                            추천 {threshold}건 이상 댓글이 없습니다. 필터를 낮춰보세요.
                        {:else}
                            이 섹션에 공감 댓글이 없습니다.
                        {/if}
                    </p>
                </div>
            {/if}
        </CardContent>
    </Card>

    <div class="mt-6">
        <AdSlot position="empathy-bottom" height="90px" slotKey="empathy-bottom" />
    </div>
</div>
