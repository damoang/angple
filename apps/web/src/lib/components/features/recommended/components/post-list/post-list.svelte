<script lang="ts">
    import { onMount } from 'svelte';
    import type { RecommendedDataWithAI, RecommendedPost } from '$lib/api/types.js';
    import Heart from '@lucide/svelte/icons/heart';
    import { formatNumber, getRecommendBadgeClass, shortenBoardName } from '../../utils/index.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte.js';

    const PREVIEW_COUNT = 15;

    let { data }: { data: RecommendedDataWithAI } = $props();

    let showReadState = $state(false);
    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });
    });

    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }

    // 섹션별로 포스트에 고유 키 부여 + 중복 제거 + 10개 제한
    const allPosts = $derived.by(() => {
        const seen = new Set<number>();
        const result: (RecommendedPost & { uniqueKey: string })[] = [];
        const sections = [
            { key: 'community', posts: data.sections.community.posts },
            { key: 'group', posts: data.sections.group.posts },
            { key: 'info', posts: data.sections.info.posts }
        ];
        for (const section of sections) {
            for (const post of section.posts ?? []) {
                if (seen.has(post.id)) continue;
                if (blockedUsersStore.isBlocked(post.author)) continue;
                seen.add(post.id);
                result.push({ ...post, uniqueKey: `${section.key}-${post.id}` });
            }
        }
        return result.slice(0, PREVIEW_COUNT);
    });
</script>

{#if allPosts.length > 0}
    <ul>
        {#each allPosts as post (post.uniqueKey)}
            <li>
                <a
                    href={post.url}
                    class="hover:bg-muted block rounded px-2 py-2 transition-all duration-200 ease-out"
                    style="padding-top: calc(0.375rem + var(--row-pad-extra, 0px)); padding-bottom: calc(0.375rem + var(--row-pad-extra, 0px));"
                >
                    <div class="flex items-center gap-2">
                        <!-- 추천수 배지 (Heart 아이콘 포함) -->
                        <span
                            class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
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
{:else}
    <div class="flex flex-col items-center justify-center py-8 text-center">
        <p class="text-muted-foreground text-sm">아직 글이 없어요</p>
    </div>
{/if}
