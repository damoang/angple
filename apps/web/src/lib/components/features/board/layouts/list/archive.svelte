<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Lock from '@lucide/svelte/icons/lock';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { formatDate } from '$lib/utils/format-date.js';

    let {
        post,
        displaySettings,
        href,
        isRead = false
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
        isRead?: boolean;
    } = $props();

    const isDeleted = $derived(!!post.deleted_at);
    const isReportLock = $derived(post.category === '게시글' || post.category === '댓글');
    const isCommentEntry = $derived(post.category === '댓글');
    const originalLink = $derived(post.link1 || '');
    const sourceBoard = $derived(post.extra_1 || '');
    const sourcePostId = $derived(post.extra_2 || '');

    const contentPreview = $derived.by(() => {
        if (!post.content) return '';
        return post.content
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200);
    });
</script>

{#if isDeleted}
    <a
        {href}
        class="bg-background border-border block rounded-lg border px-4 py-3 no-underline opacity-50"
    >
        <span class="text-muted-foreground">[삭제된 게시물입니다]</span>
    </a>
{:else if isReportLock}
    <a
        href={originalLink || href}
        class="bg-background border-border hover:bg-accent/50 group block rounded-lg border no-underline transition-all hover:shadow-sm"
    >
        <div class="border-border flex items-center justify-between border-b px-4 py-2">
            <div class="flex items-center gap-2">
                <Badge
                    variant={isCommentEntry ? 'secondary' : 'default'}
                    class="text-[11px] font-medium"
                >
                    {post.category}
                </Badge>
                {#if sourceBoard && sourcePostId}
                    <span class="text-muted-foreground font-mono text-xs">
                        {sourceBoard} #{sourcePostId}
                    </span>
                {/if}
            </div>
            <span class="text-muted-foreground text-xs">{formatDate(post.created_at)}</span>
        </div>

        <div class="px-4 py-3">
            <h3
                class="mb-1.5 flex items-center gap-2 {isRead
                    ? 'text-muted-foreground font-normal'
                    : 'text-foreground font-medium'}"
            >
                <Lock class="text-destructive/70 h-4 w-4 shrink-0" />
                <span class="line-clamp-1">{post.title}</span>
            </h3>

            {#if contentPreview}
                <p class="text-muted-foreground mb-2 line-clamp-2 text-sm leading-relaxed">
                    {contentPreview}
                </p>
            {/if}

            <div class="text-muted-foreground flex items-center gap-2 text-xs">
                <span class="text-foreground/50 font-medium">원작자</span>
                <span class="inline-flex items-center gap-0.5">
                    <LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="sm" />
                    <AuthorLink authorId={post.author_id} authorName={post.author} />
                </span>
                <span class="text-border">·</span>
                <span>조회 {post.views.toLocaleString()}</span>
            </div>
        </div>
    </a>
{:else}
    <a
        {href}
        class="bg-background border-border hover:bg-accent block rounded-lg border px-4 py-3 no-underline transition-all hover:shadow-sm"
    >
        <div class="min-w-0">
            <h3
                class="mb-1 flex items-center gap-1.5 truncate {isRead
                    ? 'text-muted-foreground font-normal'
                    : 'text-foreground font-medium'}"
            >
                {post.title}
            </h3>
            <div class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                {#if post.category}
                    <span
                        class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[11px] font-medium"
                    >
                        {post.category}
                    </span>
                {/if}
                <span class="inline-flex items-center gap-0.5">
                    <LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="sm" />
                    <AuthorLink authorId={post.author_id} authorName={post.author} />
                </span>
                <span>·</span>
                <span>{formatDate(post.created_at)}</span>
                <span>·</span>
                <span>조회 {post.views.toLocaleString()}</span>
                {#if post.comments_count > 0}
                    <span>·</span>
                    <span>💬 {post.comments_count}</span>
                {/if}
            </div>
        </div>
    </a>
{/if}
