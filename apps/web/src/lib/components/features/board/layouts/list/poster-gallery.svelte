<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import ImageIcon from '@lucide/svelte/icons/image';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { formatDate } from '$lib/utils/format-date.js';
    import { toThumbnailUrl } from '$lib/utils/thumbnail-url.js';
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

    // 삭제된 글
    const isDeleted = $derived(!!post.deleted_at);

    const rawThumbnailUrl = $derived(post.thumbnail || post.images?.[0] || '');
    const thumbnailUrl = $derived(toThumbnailUrl(rawThumbnailUrl));
    const hasImage = $derived(Boolean(thumbnailUrl));
</script>

<!-- 포스터 갤러리 레이아웃: 2:3 비율 포스터 카드 -->
{#if isDeleted}
    <a
        {href}
        class="block cursor-pointer overflow-hidden rounded-lg no-underline opacity-50 transition-shadow hover:shadow-lg"
    >
        <div class="bg-muted flex items-center justify-center" style="aspect-ratio: 2/3">
            <span class="text-muted-foreground text-sm">[삭제됨]</span>
        </div>
    </a>
{:else}
    <a
        {href}
        class="group block overflow-hidden rounded-lg no-underline transition-all hover:shadow-lg"
    >
        <!-- 포스터 영역 (2:3 비율) -->
        <div class="bg-muted relative overflow-hidden" style="aspect-ratio: 2/3">
            {#if hasImage}
                <img
                    src={thumbnailUrl}
                    alt=""
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
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
                    <ImageIcon class="text-muted-foreground h-12 w-12" />
                </div>
            {/if}

            <!-- 하단 다크 그래디언트 오버레이 -->
            <div
                class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-12"
            >
                <h3
                    class="mb-1 line-clamp-2 text-sm {isRead
                        ? 'font-normal text-white/70'
                        : 'font-medium text-white'}"
                >
                    {post.title}
                </h3>
                <div class="flex items-center gap-1.5 text-xs text-white/70">
                    <span class="inline-flex items-center gap-0.5">
                        <LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="sm" />
                        <AuthorLink
                            authorId={post.author_id}
                            authorName={post.author}
                            isWithdrawn={!!post.is_left}
                        />
                    </span>
                    <span>·</span>
                    <span>{formatDate(post.created_at)}</span>
                </div>
            </div>

            <!-- 호버 시 상세 정보 표시 -->
            <div
                class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
                <div class="text-center text-white">
                    <div class="mb-2 flex items-center justify-center gap-3 text-sm">
                        <span>👍 {post.likes}</span>
                        <span>💬 {post.comments_count}</span>
                        <span>👁 {post.views.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <!-- 카테고리 뱃지 (좌상단) -->
            {#if post.category}
                <div class="absolute left-2 top-2">
                    <Badge
                        variant="secondary"
                        class="bg-black/50 text-xs text-white backdrop-blur-sm"
                    >
                        {post.category}
                    </Badge>
                </div>
            {/if}

            <!-- 댓글 수 배지 (우상단) -->
            {#if post.comments_count > 0}
                <div class="absolute right-2 top-2">
                    <Badge
                        variant="secondary"
                        class="bg-black/50 text-xs text-white backdrop-blur-sm"
                    >
                        💬 {post.comments_count}
                    </Badge>
                </div>
            {/if}
        </div>
    </a>
{/if}

<style>
    .line-clamp-2 {
        display: -webkit-box;
        line-clamp: 2;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
