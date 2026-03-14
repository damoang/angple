<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import type {
        DailyCalendarEntry,
        DailyRecommendedData,
        RecommendedPost
    } from '$lib/api/types.js';
    import { PostCard } from '$lib/components/ui/post-card';
    import DateNavigator from './date-navigator.svelte';
    import SectionTabs from './section-tabs.svelte';
    import ThresholdFilter from './threshold-filter.svelte';
    import SortSelector from './sort-selector.svelte';
    import DailyStatsBar from './daily-stats-bar.svelte';

    interface Props {
        date: string;
        dailyData: DailyRecommendedData | null;
        calendarDates: DailyCalendarEntry[];
        oldestDate: string;
        newestDate: string;
    }

    const { date, dailyData, calendarDates, oldestDate, newestDate }: Props = $props();

    let sections = $state<DailyRecommendedData['sections'] | null>(null);
    let stats = $state<DailyRecommendedData['stats'] | null>(null);
    let dateDisplay = $state('');
    let isToday = $state(false);

    let activeTab = $state<'all' | 'community' | 'group' | 'info'>('all');
    let threshold = $state(0);
    let sortBy = $state<'recommend' | 'views' | 'comments' | 'latest'>('recommend');

    // 데이터 변경 시 동기화 (SPA 네비게이션 대응)
    $effect(() => {
        if (dailyData) {
            sections = dailyData.sections;
            stats = dailyData.stats;
            dateDisplay = dailyData.date_display;
            isToday = dailyData.is_today;
        } else {
            sections = null;
            stats = null;
            dateDisplay = '';
            isToday = false;
        }
    });

    // 필터 + 정렬 적용된 게시글 목록
    const filteredPosts = $derived.by(() => {
        if (!sections) return [];

        let posts: RecommendedPost[] = [];

        if (activeTab === 'all') {
            posts = [
                ...(sections.community.posts ?? []),
                ...(sections.group.posts ?? []),
                ...(sections.info.posts ?? [])
            ];
        } else {
            posts = [...(sections[activeTab]?.posts ?? [])];
        }

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

    // 섹션별 글 수 (필터 전)
    const sectionCounts = $derived({
        all:
            (sections?.community.count ?? 0) +
            (sections?.group.count ?? 0) +
            (sections?.info.count ?? 0),
        community: sections?.community.count ?? 0,
        group: sections?.group.count ?? 0,
        info: sections?.info.count ?? 0
    });

    // 오늘 데이터 폴링 (5분 간격)
    let pollingTimer: ReturnType<typeof setInterval> | undefined;

    onMount(() => {
        if (isToday) {
            pollingTimer = setInterval(
                async () => {
                    try {
                        const res = await fetch(`/api/recommended/daily?date=${date}`);
                        if (!res.ok) return;
                        const newData: DailyRecommendedData = await res.json();
                        sections = newData.sections;
                        stats = newData.stats;
                        dateDisplay = newData.date_display;
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
        goto(`/recommended/daily/${newDate}`);
    }
</script>

<div class="mx-auto max-w-5xl px-4 py-4">
    <!-- 헤더: 날짜 네비게이션 -->
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
            <span class="text-lg font-bold">📅 날짜별 공감글</span>
            {#if dateDisplay}
                <span class="text-muted-foreground text-sm">{dateDisplay}</span>
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

    {#if !sections}
        <!-- 데이터 없음 -->
        <div class="flex flex-col items-center justify-center rounded-lg border py-16 text-center">
            <p class="text-muted-foreground text-lg">이 날짜의 공감글 데이터가 없습니다</p>
            <p class="text-muted-foreground mt-1 text-sm">다른 날짜를 선택해 주세요</p>
        </div>
    {:else}
        <!-- 통계 바 -->
        {#if stats}
            <DailyStatsBar {stats} />
        {/if}

        <!-- 필터 영역 -->
        <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <SectionTabs bind:activeTab counts={sectionCounts} />
            <div class="flex items-center gap-2">
                <ThresholdFilter bind:threshold />
                <SortSelector bind:sortBy />
            </div>
        </div>

        <!-- 게시글 목록 -->
        {#if filteredPosts.length > 0}
            <ul class="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-x-4">
                {#each filteredPosts as post (post.id + '-' + post.board)}
                    <PostCard {post} />
                {/each}
            </ul>
            <p class="text-muted-foreground mt-3 text-center text-xs">
                {filteredPosts.length}건 표시
                {#if threshold > 0}
                    (추천 {threshold}+ 필터 적용)
                {/if}
            </p>
        {:else}
            <div
                class="flex flex-col items-center justify-center rounded-lg border py-12 text-center"
            >
                <p class="text-muted-foreground text-sm">
                    {#if threshold > 0}
                        추천 {threshold}건 이상 글이 없습니다. 필터를 낮춰보세요.
                    {:else}
                        이 섹션에 글이 없습니다.
                    {/if}
                </p>
            </div>
        {/if}
    {/if}
</div>
