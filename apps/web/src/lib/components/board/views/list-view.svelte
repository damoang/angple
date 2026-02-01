<script lang="ts">
    import type { PostSummary } from './types';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import ThumbsUp from '@lucide/svelte/icons/thumbs-up';
    import Eye from '@lucide/svelte/icons/eye';
    import Pin from '@lucide/svelte/icons/pin';

    interface Props {
        posts: PostSummary[];
        boardId: string;
        isLoading?: boolean;
    }

    let { posts, boardId, isLoading = false }: Props = $props();
</script>

<div class="divide-y">
    {#each posts as post (post.id)}
        <a
            href="/boards/{boardId}/{post.id}"
            class="hover:bg-muted/50 flex items-center gap-4 px-4 py-3 transition-colors"
        >
            <!-- 고정 아이콘 -->
            {#if post.isPinned}
                <Pin class="text-primary h-4 w-4 flex-shrink-0" />
            {/if}

            <!-- 제목 영역 -->
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                    <span class="truncate font-medium">{post.title}</span>
                    {#if post.isNew}
                        <span class="bg-primary text-primary-foreground rounded px-1 text-xs">N</span>
                    {/if}
                    {#if post.commentCount > 0}
                        <span class="text-primary text-xs font-medium">[{post.commentCount}]</span>
                    {/if}
                </div>
                <div class="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                    <span>{post.author}</span>
                    <span>{post.createdAt}</span>
                </div>
            </div>

            <!-- 통계 -->
            <div class="text-muted-foreground flex flex-shrink-0 items-center gap-3 text-xs">
                <span class="flex items-center gap-1">
                    <Eye class="h-3 w-3" />
                    {post.viewCount}
                </span>
                <span class="flex items-center gap-1">
                    <ThumbsUp class="h-3 w-3" />
                    {post.likeCount}
                </span>
            </div>
        </a>
    {/each}

    {#if posts.length === 0 && !isLoading}
        <div class="text-muted-foreground py-12 text-center">게시물이 없습니다.</div>
    {/if}
</div>
