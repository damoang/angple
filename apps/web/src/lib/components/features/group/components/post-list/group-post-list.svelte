<script lang="ts">
    import type { GroupPost } from '$lib/api/types.js';
    import { formatNumber, getRecommendBadgeClass } from '../../../recommended/utils/index.js';

    type Props = {
        posts: GroupPost[];
    };

    let { posts }: Props = $props();
</script>

{#if posts.length > 0}
    <ul class="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-x-4">
        {#each posts as post (post.id)}
            <li class="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
                <a
                    href={post.url}
                    class="block rounded px-2 py-0.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                    <div class="flex items-center gap-2">
                        <span
                            class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded px-2 py-0.5 text-sm font-bold {getRecommendBadgeClass(
                                post.recommend_count
                            )}"
                        >
                            {formatNumber(post.recommend_count)}
                        </span>
                        <div class="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                            {post.title}
                        </div>
                    </div>
                </a>
            </li>
        {/each}
    </ul>
{:else}
    <div class="text-muted-foreground py-8 text-center text-sm">게시물이 없습니다.</div>
{/if}
