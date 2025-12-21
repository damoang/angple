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
            <li>
                <a
                    href={post.url}
                    class="hover:bg-muted block rounded px-2 py-1.5 transition-all duration-200 ease-out"
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
    <div class="flex flex-col items-center justify-center py-8 text-center">
        <p class="text-muted-foreground text-sm">아직 글이 없어요</p>
    </div>
{/if}
