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
    import type { ExploreData, ExploreMode, ExplorePost } from '$lib/api/types.js';

    interface Props {
        prefetchData?: { data: ExploreData } | unknown;
    }

    const { prefetchData }: Props = $props();

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
        return posts.filter((p) => !blockedUsersStore.isBlocked(p.author)).slice(0, PREVIEW_COUNT);
    });

    async function loadExploreData(): Promise<void> {
        if (requested || exploreData) {
            loading = false;
            return;
        }
        requested = true;

        try {
            const res = await fetch('/api/widgets/explore/data');
            if (res.ok) {
                exploreData = await res.json();
            }
        } catch {
            // silent fail
        } finally {
            loading = false;
        }
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
                    scheduleLoad();
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
        <CardHeader class="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
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
            {:else if modePosts.length === 0}
                <div class="text-muted-foreground py-6 text-center text-sm">
                    데이터를 준비하고 있습니다...
                </div>
            {:else}
                <ul>
                    {#each modePosts as post (post.board + '-' + post.id)}
                        <li>
                            <a
                                href={post.url}
                                class="hover:bg-muted block rounded px-0.5 py-1.5 transition-all duration-200 ease-out"
                                style="padding-top: var(--row-pad-extra, 0px); padding-bottom: var(--row-pad-extra, 0px);"
                            >
                                <div class="flex items-center gap-1">
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
