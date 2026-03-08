<script lang="ts">
    import { onMount } from 'svelte';
    import type { NewsPost } from '$lib/api/types.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';

    type Props = {
        posts: NewsPost[];
    };

    let { posts }: Props = $props();

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
    <ul class="grid grid-cols-1 gap-0 lg:grid-cols-2 lg:gap-x-4">
        {#each posts as post (post.id)}
            <li>
                <a
                    href={post.url}
                    rel="external"
                    class="hover:bg-muted block rounded px-2 py-1.5 transition-all duration-200 ease-out"
                >
                    <div class="flex items-center gap-2">
                        <div
                            class="min-w-0 flex-1 truncate text-sm leading-relaxed {getReadPostClasses(
                                showReadState && readPostsStore.isRead(post.board, post.id)
                            )}"
                        >
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
