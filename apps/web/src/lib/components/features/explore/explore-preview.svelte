<script lang="ts">
    import { onMount } from 'svelte';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import Compass from '@lucide/svelte/icons/compass';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import {
        formatNumber,
        getRecommendBadgeClass
    } from '$lib/components/features/recommended/utils/index.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import type { ExploreData, ExplorePost } from '$lib/api/types.js';

    interface Props {
        prefetchData?: { data: ExploreData } | unknown;
    }

    const { prefetchData }: Props = $props();

    const ssrData = prefetchData as { data: ExploreData } | undefined;
    let exploreData = $state<ExploreData | null>(ssrData?.data ?? null);
    let loading = $state(!ssrData?.data);
    let showReadState = $state(false);

    const PREVIEW_COUNT = 10;

    const hotPosts = $derived<ExplorePost[]>(
        exploreData?.modes?.hot?.posts?.slice(0, PREVIEW_COUNT) ?? []
    );

    onMount(async () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });

        if (!exploreData) {
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
    });

    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row items-center justify-between gap-2 space-y-0 py-3">
        <div class="flex shrink-0 items-center gap-2">
            <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30"
            >
                <Compass class="h-4 w-4 text-teal-500" />
            </div>
            <h3 class="text-foreground text-lg font-semibold">톺아보기</h3>
            <span class="text-muted-foreground text-xs">핫</span>
        </div>
        <a
            href="/explore"
            class="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-xs transition-colors"
        >
            더보기
            <ChevronRight class="h-3.5 w-3.5" />
        </a>
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
        {:else if hotPosts.length === 0}
            <div class="text-muted-foreground py-6 text-center text-sm">
                데이터를 준비하고 있습니다...
            </div>
        {:else}
            <ul>
                {#each hotPosts as post (post.board + '-' + post.id)}
                    <li>
                        <a
                            href={post.url}
                            class="hover:bg-muted block rounded px-2 py-1.5 transition-all duration-200 ease-out"
                        >
                            <div class="flex items-center gap-2">
                                <!-- 추천수 배지 -->
                                <span
                                    class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                                        post.recommend_count
                                    )}"
                                >
                                    <img alt="공감" class="size-3" src="/images/thumbup.png?v=2" />
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
                                            readPostsStore.isRead(getBoardId(post.url), post.id)
                                    )}"
                                >
                                    {post.title}
                                </span>

                                <!-- 댓글 수 -->
                                {#if post.comment_count > 0}
                                    <span
                                        class="text-primary flex shrink-0 items-center gap-0.5 text-xs"
                                    >
                                        <MessageSquare class="h-3 w-3" />
                                        {post.comment_count}
                                    </span>
                                {/if}
                            </div>
                        </a>
                    </li>
                {/each}
            </ul>
        {/if}
    </CardContent>
</Card>
