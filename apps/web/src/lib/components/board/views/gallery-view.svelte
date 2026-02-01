<script lang="ts">
    import type { PostSummary } from './types';
    import ImageIcon from '@lucide/svelte/icons/image';
    import MessageSquare from '@lucide/svelte/icons/message-square';

    interface Props {
        posts: PostSummary[];
        boardId: string;
        isLoading?: boolean;
    }

    let { posts, boardId, isLoading = false }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
    {#each posts as post (post.id)}
        <a
            href="/boards/{boardId}/{post.id}"
            class="group relative aspect-square overflow-hidden rounded-lg"
        >
            {#if post.thumbnail}
                <img
                    src={post.thumbnail}
                    alt={post.title}
                    class="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                />
            {:else}
                <div class="bg-muted flex h-full w-full items-center justify-center">
                    <ImageIcon class="text-muted-foreground h-8 w-8" />
                </div>
            {/if}

            <!-- 오버레이 -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                <div class="absolute bottom-0 left-0 right-0 p-2 text-white">
                    <p class="line-clamp-2 text-xs font-medium">{post.title}</p>
                    <div class="mt-1 flex items-center gap-2 text-[10px] opacity-80">
                        <span>{post.author}</span>
                        {#if post.commentCount > 0}
                            <span class="flex items-center gap-0.5">
                                <MessageSquare class="h-2.5 w-2.5" />
                                {post.commentCount}
                            </span>
                        {/if}
                    </div>
                </div>
            </div>
        </a>
    {/each}

    {#if posts.length === 0 && !isLoading}
        <div class="text-muted-foreground col-span-full py-12 text-center">게시물이 없습니다.</div>
    {/if}
</div>
