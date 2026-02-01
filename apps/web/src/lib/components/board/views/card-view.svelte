<script lang="ts">
    import type { PostSummary } from './types';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
    import Eye from '@lucide/svelte/icons/eye';

    interface Props {
        posts: PostSummary[];
        boardId: string;
        isLoading?: boolean;
    }

    let { posts, boardId, isLoading = false }: Props = $props();
</script>

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each posts as post (post.id)}
        <a
            href="/boards/{boardId}/{post.id}"
            class="bg-card hover:bg-muted/50 overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
        >
            <!-- 썸네일 -->
            {#if post.thumbnail}
                <div class="bg-muted aspect-video">
                    <img
                        src={post.thumbnail}
                        alt={post.title}
                        class="h-full w-full object-cover"
                        loading="lazy"
                    />
                </div>
            {/if}

            <div class="p-4">
                <h3 class="mb-1 line-clamp-2 font-medium">{post.title}</h3>
                {#if post.excerpt}
                    <p class="text-muted-foreground mb-3 line-clamp-2 text-sm">{post.excerpt}</p>
                {/if}

                <!-- 태그 -->
                {#if post.tags && post.tags.length > 0}
                    <div class="mb-3 flex flex-wrap gap-1">
                        {#each post.tags.slice(0, 3) as tag (tag)}
                            <span class="bg-muted rounded px-1.5 py-0.5 text-xs">{tag}</span>
                        {/each}
                    </div>
                {/if}

                <!-- 메타 -->
                <div class="text-muted-foreground flex items-center justify-between text-xs">
                    <span>{post.author} · {post.createdAt}</span>
                    <div class="flex items-center gap-2">
                        <span class="flex items-center gap-0.5">
                            <MessageSquare class="h-3 w-3" />
                            {post.commentCount}
                        </span>
                        <span class="flex items-center gap-0.5">
                            <ThumbsUp class="h-3 w-3" />
                            {post.likeCount}
                        </span>
                    </div>
                </div>
            </div>
        </a>
    {/each}

    {#if posts.length === 0 && !isLoading}
        <div class="text-muted-foreground col-span-full py-12 text-center">게시물이 없습니다.</div>
    {/if}
</div>
