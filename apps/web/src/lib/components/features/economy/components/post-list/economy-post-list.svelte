<script lang="ts">
    import type { EconomyPost } from '$lib/api/types.js';

    type Props = {
        posts: EconomyPost[];
    };

    let { posts }: Props = $props();
</script>

{#if posts.length > 0}
    <ul class="grid grid-cols-2 gap-x-4 gap-y-0">
        {#each posts as post (post.id)}
            <li class="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
                <a
                    href={post.url}
                    class="block rounded px-2 py-0.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                    <div class="flex items-center gap-2">
                        <div class="text-foreground min-w-0 flex-1 truncate text-xs font-medium">
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
