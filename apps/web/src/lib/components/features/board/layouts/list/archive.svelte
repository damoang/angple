<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { formatDate, isToday } from '$lib/utils/format-date.js';
    import { formatCompactNumber } from '$lib/utils/format-number.js';
    import { readPostStyleStore } from '$lib/stores/read-post-style.svelte.js';

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
    const iconUrl = $derived(getAvatarUrl(post.author_image, post.author_image_updated_at));
    const readClass = $derived(
        isRead ? `post-title-read-${readPostStyleStore.value}` : 'post-title'
    );
</script>

{#if isDeleted}
    <a
        {href}
        class="bg-background hover:bg-accent block cursor-pointer px-4 py-1.5 no-underline opacity-50"
    >
        <div class="flex items-center gap-2 md:gap-3">
            <div class="hidden w-[50px] shrink-0 md:block">
                <span class="text-muted-foreground text-xs">-</span>
            </div>
            <span class="text-muted-foreground text-[15px]">[삭제된 게시물입니다]</span>
        </div>
    </a>
{:else}
    <a
        href={isReportLock ? originalLink || href : href}
        class="archive-row bg-background hover:bg-accent block px-4 no-underline transition-colors"
    >
        <div
            class="flex items-center gap-2 md:grid md:grid-cols-[50px_1fr_auto_auto_auto] md:items-center md:gap-0"
        >
            <!-- col 1: 배지 (데스크톱) -->
            <div class="hidden md:flex md:items-center md:justify-center">
                {#if isReportLock}
                    <Badge
                        variant={isCommentEntry ? 'secondary' : 'default'}
                        class="px-1.5 py-0 text-[10px] font-semibold"
                    >
                        {isCommentEntry ? '댓글' : '게시글'}
                    </Badge>
                {:else if post.category}
                    <span
                        class="bg-primary/10 text-primary rounded px-1.5 py-0 text-[10px] font-medium"
                    >
                        {post.category}
                    </span>
                {:else}
                    <span class="text-muted-foreground/30 text-xs">-</span>
                {/if}
            </div>

            <!-- col 2~5: 콘텐츠 -->
            <div class="min-w-0 flex-1 space-y-1 md:contents md:space-y-0">
                <!-- 제목 줄 (col 2) -->
                <div class="flex min-w-0 items-center gap-1">
                    <!-- 모바일 배지 -->
                    {#if isReportLock}
                        <Badge
                            variant={isCommentEntry ? 'secondary' : 'default'}
                            class="shrink-0 px-1 py-0 text-[10px] md:hidden"
                        >
                            {isCommentEntry ? '댓' : '글'}
                        </Badge>
                    {:else if post.category}
                        <span
                            class="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0 text-xs font-medium md:hidden"
                        >
                            {post.category}
                        </span>
                    {/if}

                    {#if isReportLock && sourceBoard && sourcePostId}
                        <span
                            class="text-muted-foreground hidden shrink-0 font-mono text-xs md:inline"
                        >
                            {sourceBoard}#{sourcePostId}
                        </span>
                    {/if}

                    <span class="truncate {readClass}">
                        {post.title}
                    </span>

                    {#if post.comments_count > 0}
                        <span class="comment-count shrink-0">+{post.comments_count}</span>
                    {/if}
                </div>

                <!-- 이름 (col 3, 데스크톱) -->
                <span
                    class="post-meta-text hidden items-center gap-1 truncate md:inline-flex md:w-[120px] md:pl-1"
                >
                    {#if iconUrl}
                        <img
                            src={iconUrl}
                            alt=""
                            class="h-5 w-5 shrink-0 rounded-full object-cover"
                            onerror={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                            }}
                        />
                    {/if}
                    <AuthorLink
                        authorId={post.author_id}
                        authorName={post.author}
                        isWithdrawn={!!post.is_left}
                    />
                </span>

                <!-- 날짜 (col 4, 데스크톱) -->
                <span
                    class="post-meta-text hidden md:inline md:w-[70px] md:pl-1 md:text-center {isToday(
                        post.created_at
                    )
                        ? 'date-today'
                        : ''}"
                >
                    {formatDate(post.created_at)}
                </span>

                <!-- 조회수 (col 5, 데스크톱) -->
                <span class="post-meta-text hidden md:inline md:w-[50px] md:pl-1 md:text-center">
                    {formatCompactNumber(post.views)}
                </span>

                <!-- 모바일 메타 (Line 2) -->
                <div class="mobile-meta">
                    <span class="inline-flex items-center gap-0.5">
                        {#if iconUrl}
                            <img
                                src={iconUrl}
                                alt=""
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                                onerror={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    img.style.display = 'none';
                                }}
                            />
                        {/if}
                        <AuthorLink
                            authorId={post.author_id}
                            authorName={post.author}
                            isWithdrawn={!!post.is_left}
                        />
                    </span>
                    <span class="mobile-meta-sep {isToday(post.created_at) ? 'date-today' : ''}">
                        {formatDate(post.created_at)}
                    </span>
                    <span class="mobile-meta-sep">{formatCompactNumber(post.views)}</span>
                    {#if isReportLock && sourceBoard}
                        <span class="mobile-meta-sep font-mono">{sourceBoard}#{sourcePostId}</span>
                    {/if}
                </div>
            </div>
        </div>
    </a>
{/if}

<style>
    .archive-row {
        padding-top: calc(6px + var(--row-pad-extra, 3px));
        padding-bottom: calc(6px + var(--row-pad-extra, 3px));
    }

    @media (min-width: 768px) {
        .archive-row {
            padding-top: calc(4px + var(--row-pad-extra, 3px));
            padding-bottom: calc(4px + var(--row-pad-extra, 3px));
        }
    }

    .post-title,
    [class^='post-title-read-'] {
        font-size: var(--list-font-size, 1rem);
        transition: color 0.8s ease-in-out;
    }

    .post-title {
        color: var(--color-foreground);
    }

    .post-title-read-dimmed {
        color: var(--color-muted-foreground);
        opacity: 0.55;
    }

    .post-title-read-bold {
        color: var(--color-muted-foreground);
        font-weight: 700;
    }

    .post-title-read-italic {
        color: var(--color-muted-foreground);
        font-style: italic;
    }

    .post-title-read-strikethrough {
        color: var(--color-muted-foreground);
        text-decoration: line-through;
    }

    .post-meta-text {
        font-size: 15px;
        color: var(--color-muted-foreground);
    }

    .comment-count {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-liked, orangered);
    }

    .mobile-meta {
        display: none;
        font-size: 13px;
        color: var(--color-muted-foreground);
    }

    @media (max-width: 767.98px) {
        .mobile-meta {
            display: flex !important;
            align-items: center;
            gap: 0.25rem;
        }
    }

    .mobile-meta-sep::before {
        content: '·';
        margin-right: 0.25rem;
    }

    .date-today {
        color: var(--color-date-today);
    }
</style>
