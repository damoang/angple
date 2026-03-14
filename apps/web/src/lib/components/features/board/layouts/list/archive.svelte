<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
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
</script>

{#if isDeleted}
    <a {href} class="text-muted-foreground block px-4 py-2 text-sm no-underline opacity-50">
        [삭제된 게시물입니다]
    </a>
{:else if isReportLock}
    <a
        href={originalLink || href}
        class="hover:bg-accent flex items-center gap-2 px-4 py-2 no-underline transition-colors"
    >
        <!-- 카테고리 배지 -->
        <Badge
            variant={isCommentEntry ? 'secondary' : 'default'}
            class="shrink-0 px-1.5 py-0 text-[10px]"
        >
            {isCommentEntry ? '댓' : '글'}
        </Badge>

        <!-- 출처 -->
        {#if sourceBoard && sourcePostId}
            <span class="text-muted-foreground hidden shrink-0 font-mono text-xs sm:inline">
                {sourceBoard}#{sourcePostId}
            </span>
        {/if}

        <!-- 제목 -->
        <span
            class="min-w-0 flex-1 truncate text-sm {isRead
                ? 'text-muted-foreground'
                : 'text-foreground'}"
        >
            {post.title}
        </span>

        <!-- 원작자 -->
        <span class="hidden shrink-0 items-center gap-1 text-xs sm:inline-flex">
            <LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="sm" />
            <AuthorLink authorId={post.author_id} authorName={post.author} />
        </span>

        <!-- 날짜 -->
        <span class="text-muted-foreground shrink-0 text-xs">
            {formatDate(post.created_at)}
        </span>
    </a>
{:else}
    <!-- 일반 글 -->
    <a
        {href}
        class="hover:bg-accent flex items-center gap-2 px-4 py-2 no-underline transition-colors"
    >
        {#if post.category}
            <span
                class="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0 text-[10px] font-medium"
            >
                {post.category}
            </span>
        {/if}

        <span
            class="min-w-0 flex-1 truncate text-sm {isRead
                ? 'text-muted-foreground'
                : 'text-foreground'}"
        >
            {post.title}
        </span>

        <span class="hidden shrink-0 items-center gap-1 text-xs sm:inline-flex">
            <LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="sm" />
            <AuthorLink authorId={post.author_id} authorName={post.author} />
        </span>

        <span class="text-muted-foreground shrink-0 text-xs">
            {formatDate(post.created_at)}
        </span>
    </a>
{/if}
