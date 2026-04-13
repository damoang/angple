<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import ImageIcon from '@lucide/svelte/icons/image';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { formatDate, formatDateCompact } from '$lib/utils/format-date.js';
    import { toThumbnailUrl } from '$lib/utils/thumbnail-url.js';
    // Props (동일 인터페이스)
    let {
        post,
        displaySettings,
        href,
        isRead = false,
        isPriority = false
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
        isRead?: boolean;
        isPriority?: boolean;
    } = $props();

    // 삭제된 글
    const isDeleted = $derived(!!post.deleted_at);

    const rawThumbnailUrl = $derived(
        post.thumbnail_raw || post.thumbnail || post.images?.[0] || ''
    );
    const thumbnailUrl = $derived(toThumbnailUrl(rawThumbnailUrl));
    const hasImage = $derived(Boolean(thumbnailUrl));
</script>

<!-- Gallery 레이아웃: 썸네일 중심 카드 (그리드 아이템) -->
{#if isDeleted}
    <a
        {href}
        class="bg-background border-border block cursor-pointer overflow-hidden rounded-lg border no-underline opacity-50 transition-shadow hover:shadow-md"
    >
        <div class="bg-muted flex aspect-video items-center justify-center">
            <span class="text-muted-foreground text-sm">[삭제됨]</span>
        </div>
    </a>
{:else}
    <a
        {href}
        class="bg-background border-border hover:border-primary/30 group block overflow-hidden rounded-lg border no-underline transition-all hover:shadow-md"
    >
        <!-- 썸네일 영역 -->
        <div class="bg-muted relative aspect-video overflow-hidden">
            {#if hasImage}
                <img
                    src={thumbnailUrl}
                    alt=""
                    class="h-full w-full object-cover transition-transform group-hover:scale-105"
                    loading={isPriority ? 'eager' : 'lazy'}
                    fetchpriority={isPriority ? 'high' : 'auto'}
                    decoding="async"
                    width="400"
                    height="225"
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    onerror={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (rawThumbnailUrl && target.src !== rawThumbnailUrl) {
                            target.src = rawThumbnailUrl;
                        } else {
                            target.style.display = 'none';
                        }
                    }}
                />
            {:else}
                <div class="flex h-full items-center justify-center">
                    <ImageIcon class="text-muted-foreground h-10 w-10" />
                </div>
            {/if}

            <!-- 카테고리 뱃지 (이미지 위) -->
            {#if post.category}
                <div class="absolute left-2 top-2">
                    <Badge variant="secondary" class="bg-background/80 text-xs backdrop-blur-sm">
                        {post.category}
                    </Badge>
                </div>
            {/if}

            <!-- 댓글 수 (이미지 위) -->
            {#if post.comments_count > 0 && !post.is_comments_disabled}
                <div class="absolute bottom-2 right-2">
                    <Badge variant="secondary" class="bg-background/80 text-xs backdrop-blur-sm">
                        💬 {post.comments_count}
                    </Badge>
                </div>
            {/if}
        </div>

        <!-- 정보 영역 -->
        <div class="p-3">
            <h3
                class="mb-1.5 truncate font-medium {isRead
                    ? 'text-muted-foreground'
                    : 'text-foreground'}"
                style="font-size: var(--list-font-size);"
            >
                {post.title}
            </h3>
            <div class="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span>👍 {post.likes}</span>
                <span>·</span>
                <span class="inline-flex items-center gap-0.5"
                    ><AuthorLink
                        authorId={post.author_id}
                        authorName={post.author}
                        isWithdrawn={!!post.is_left}
                    /></span
                >
                <span>·</span>
                <span>{formatDateCompact(post.created_at)}</span>
            </div>
        </div>
    </a>
{/if}
