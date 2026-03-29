<script lang="ts">
    import { onMount } from 'svelte';
    import type { EconomyPost } from '$lib/api/types.js';
    import Heart from '@lucide/svelte/icons/heart';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import {
        formatNumber,
        getRecommendBadgeClass,
        shortenBoardName
    } from '../../../recommended/utils/index.js';

    type Props = {
        posts: EconomyPost[];
    };

    let { posts }: Props = $props();

    // URL에서 boardId 추출 (/{boardId}/{postId} 형태)
    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }

    // 읽은 글 표시 (하이드레이션 깜빡임 방지)
    let showReadState = $state(false);
    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });
    });
</script>

{#if posts.length > 0}
    <ul>
        {#each posts as post (post.id)}
            <li>
                <a
                    href={post.url}
                    class="hover:bg-muted block rounded px-1 py-2 transition-all duration-200 ease-out"
                    style="padding-top: calc(0.0625rem + var(--row-pad-extra, 0px)); padding-bottom: calc(0.0625rem + var(--row-pad-extra, 0px));"
                >
                    <div class="flex items-center gap-2">
                        <!-- 추천수 배지 -->
                        <span
                            class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                                post.recommend_count ?? 0
                            )}"
                        >
                            <Heart class="size-3" />
                            {formatNumber(post.recommend_count ?? 0)}
                        </span>

                        <!-- 게시판 뱃지 -->
                        {#if post.board_name}
                            <span
                                class="bg-muted text-muted-foreground hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline-block"
                            >
                                {shortenBoardName(post.board_name)}
                            </span>
                        {/if}

                        <!-- 제목 -->
                        <span
                            class="min-w-0 flex-1 truncate leading-relaxed {getReadPostClasses(
                                showReadState &&
                                    readPostsStore.isRead(
                                        post.board || getBoardId(post.url),
                                        post.id
                                    )
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
{:else}
    <div class="flex flex-col items-center justify-center py-8 text-center">
        <p class="text-muted-foreground text-sm">아직 글이 없어요</p>
    </div>
{/if}
