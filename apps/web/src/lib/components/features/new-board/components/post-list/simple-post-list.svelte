<script lang="ts">
    import { onMount } from 'svelte';
    import type { NewsPost } from '$lib/api/types.js';
    import Heart from '@lucide/svelte/icons/heart';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import {
        formatNumber,
        getRecommendBadgeClass,
        shortenBoardName
    } from '../../../recommended/utils/index.js';

    type Props = {
        posts: NewsPost[];
    };

    let { posts }: Props = $props();

    // 같은 글이 여러 소스(추천·모아보기 등)에서 중복 유입되면 keyed each 가
    // each_key_duplicate 로 하이드레이션을 무너뜨린다(2026-07-22 홈 크래시).
    // id 기준 첫 등장만 남겨 유니크화 — 크래시 방어 + 중복 표시 제거.
    const uniquePosts = $derived.by(() => {
        const seen = new Set<NewsPost['id']>();
        return posts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    });

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

{#if uniquePosts.length > 0}
    <ul>
        {#each uniquePosts as post (post.id)}
            <li>
                <a
                    href={post.url}
                    class="hover:bg-muted block rounded px-0.5 py-1.5 transition-all duration-200 ease-out"
                    style="padding-top: calc(0.125rem + var(--row-pad-extra, 0px)); padding-bottom: calc(0.125rem + var(--row-pad-extra, 0px));"
                >
                    <div class="flex items-center gap-1">
                        <!-- 추천수 배지 -->
                        <span
                            class="inline-flex w-[2.75rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                                post.recommend_count
                            )}"
                        >
                            <Heart class="size-3" />
                            {formatNumber(post.recommend_count)}
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
                                showReadState && readPostsStore.isRead(post.board, post.id)
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
