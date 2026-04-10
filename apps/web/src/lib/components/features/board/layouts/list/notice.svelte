<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Eye from '@lucide/svelte/icons/eye';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import Pin from '@lucide/svelte/icons/pin';
    import { formatDate, formatDateCompact } from '$lib/utils/format-date.js';
    import { highlightQuery } from '$lib/utils/highlight.js';
    let {
        post,
        displaySettings,
        href,
        isRead = false,
        searchQuery = ''
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
        isRead?: boolean;
        searchQuery?: string;
    } = $props();

    const isDeleted = $derived(!!post.deleted_at);
</script>

<!-- Notice 스킨: 카드형 공지사항 스타일 (배지 + 깔끔한 메타데이터) -->
{#if isDeleted}
    <a
        {href}
        class="border-border bg-background hover:border-primary/30 hover:bg-muted/30 block cursor-pointer rounded-lg border px-4 py-3 no-underline opacity-50 transition-all"
    >
        <span class="text-muted-foreground">[삭제된 게시물입니다]</span>
    </a>
{:else}
    <a
        {href}
        class="bg-background border-border hover:border-primary/30 hover:bg-muted/30 block rounded-lg border p-4 no-underline transition-all"
    >
        <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
                <div class="mb-1 flex flex-wrap items-center gap-2">
                    {#if post.is_notice}
                        {#if post.notice_type === 'important'}
                            <Badge variant="destructive" class="text-xs">필수</Badge>
                        {:else}
                            <Badge variant="default" class="text-xs">
                                <Pin class="mr-0.5 h-3 w-3" />공지
                            </Badge>
                        {/if}
                    {/if}
                    {#if post.category}
                        <Badge variant="secondary" class="text-xs">{post.category}</Badge>
                    {/if}
                    <h2
                        class="line-clamp-1 flex-1 {isRead
                            ? 'text-muted-foreground font-normal'
                            : 'text-foreground font-medium'}"
                    >
                        {#if searchQuery}
                            {@html highlightQuery(post.title, searchQuery)}
                        {:else}
                            {post.title}
                        {/if}
                    </h2>
                </div>
                <div class="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                    <AuthorLink
                        authorId={post.author_id}
                        authorName={post.author}
                        isWithdrawn={!!post.is_left}
                    />
                    <span>{formatDateCompact(post.created_at)}</span>
                    <span class="flex items-center gap-1">
                        <Eye class="h-3.5 w-3.5" />
                        {post.views.toLocaleString()}
                    </span>
                    {#if post.comments_count > 0}
                        <span class="text-primary flex items-center gap-1">
                            <MessageSquare class="h-3.5 w-3.5" />
                            {post.comments_count}
                        </span>
                    {/if}
                </div>
            </div>
        </div>
    </a>
{/if}
