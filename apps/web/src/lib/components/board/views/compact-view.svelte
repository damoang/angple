<script lang="ts">
    import type { PostSummary } from './types';
    import Pin from '@lucide/svelte/icons/pin';

    interface Props {
        posts: PostSummary[];
        boardId: string;
        isLoading?: boolean;
    }

    let { posts, boardId, isLoading = false }: Props = $props();
</script>

<div class="divide-y text-sm">
    {#each posts as post (post.id)}
        <a
            href="/boards/{boardId}/{post.id}"
            class="hover:bg-muted/50 flex items-center gap-2 px-3 py-1.5 transition-colors"
        >
            {#if post.isPinned}
                <Pin class="text-primary h-3 w-3 flex-shrink-0" />
            {/if}
            <span class="min-w-0 flex-1 truncate">{post.title}</span>
            {#if post.commentCount > 0}
                <span class="text-primary flex-shrink-0 text-xs">[{post.commentCount}]</span>
            {/if}
            <span class="text-muted-foreground flex-shrink-0 text-xs">{post.author}</span>
            <span class="text-muted-foreground flex-shrink-0 text-xs">{post.createdAt}</span>
            <span class="text-muted-foreground flex-shrink-0 text-xs">{post.viewCount}</span>
        </a>
    {/each}

    {#if posts.length === 0 && !isLoading}
        <div class="text-muted-foreground py-12 text-center">게시물이 없습니다.</div>
    {/if}
</div>
