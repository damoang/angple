<script lang="ts">
    import type { PostSummary } from './types';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
    import Circle from '@lucide/svelte/icons/circle';

    interface Props {
        posts: PostSummary[];
        boardId: string;
        isLoading?: boolean;
    }

    let { posts, boardId, isLoading = false }: Props = $props();
</script>

<div class="relative ml-4 border-l-2 pl-6">
    {#each posts as post, index (post.id)}
        <div class="relative mb-6">
            <!-- 타임라인 도트 -->
            <div
                class="bg-background border-primary absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2"
            >
                <Circle class="text-primary h-1.5 w-1.5 fill-current" />
            </div>

            <!-- 시간 -->
            <time class="text-muted-foreground mb-1 block text-xs">{post.createdAt}</time>

            <!-- 카드 -->
            <a
                href="/boards/{boardId}/{post.id}"
                class="bg-card hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
            >
                <h3 class="mb-1 font-medium">{post.title}</h3>
                {#if post.excerpt}
                    <p class="text-muted-foreground mb-2 line-clamp-2 text-sm">{post.excerpt}</p>
                {/if}

                {#if post.thumbnail}
                    <div class="bg-muted mb-2 max-h-48 overflow-hidden rounded">
                        <img
                            src={post.thumbnail}
                            alt={post.title}
                            class="w-full object-cover"
                            loading="lazy"
                        />
                    </div>
                {/if}

                <div class="text-muted-foreground flex items-center gap-3 text-xs">
                    <span>{post.author}</span>
                    <span class="flex items-center gap-0.5">
                        <MessageSquare class="h-3 w-3" />
                        {post.commentCount}
                    </span>
                    <span class="flex items-center gap-0.5">
                        <ThumbsUp class="h-3 w-3" />
                        {post.likeCount}
                    </span>
                </div>
            </a>
        </div>
    {/each}

    {#if posts.length === 0 && !isLoading}
        <div class="text-muted-foreground py-12 text-center">게시물이 없습니다.</div>
    {/if}
</div>
