<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Lock from '@lucide/svelte/icons/lock';
    import ImageIcon from '@lucide/svelte/icons/image';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { formatDate } from '$lib/utils/format-date.js';
    import { toThumbnailUrl } from '$lib/utils/thumbnail-url.js';
    // Props
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

    // 썸네일 표시 여부
    const rawThumbnailUrl = $derived(
        post.thumbnail_raw || post.thumbnail || post.images?.[0] || ''
    );
    const thumbnailUrl = $derived(toThumbnailUrl(rawThumbnailUrl));
    const showThumbnail = $derived(displaySettings?.show_thumbnail && !!rawThumbnailUrl);
</script>

<!-- Compact 스킨: 제목 + 메타데이터 + 태그만 (심플) -->
{#if isDeleted}
    <a
        {href}
        class="bg-background border-border hover:bg-accent block cursor-pointer rounded-lg border px-4 py-3 no-underline opacity-50 transition-all"
    >
        <span class="text-muted-foreground">[삭제된 게시물입니다]</span>
    </a>
{:else}
    <a
        {href}
        class="bg-background border-border hover:bg-accent block rounded-lg border px-4 py-3 no-underline transition-all hover:shadow-sm"
    >
        <div class="flex items-center justify-between gap-4">
            <!-- 썸네일 (있는 경우) -->
            {#if showThumbnail}
                <div class="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
                    <img
                        src={thumbnailUrl}
                        alt=""
                        class="h-full w-full object-cover"
                        onerror={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (rawThumbnailUrl && target.src !== rawThumbnailUrl) {
                                target.src = rawThumbnailUrl;
                            } else {
                                target.style.display = 'none';
                            }
                        }}
                    />
                </div>
            {:else if post.has_file}
                <!-- 이미지가 아닌 파일 첨부 표시 -->
                <div
                    class="bg-muted flex h-14 w-14 shrink-0 items-center justify-center rounded-md"
                >
                    <ImageIcon class="text-muted-foreground h-6 w-6" />
                </div>
            {/if}

            <!-- 좌측: 제목 + 메타데이터 -->
            <div class="min-w-0 flex-1">
                <h3
                    class="mb-1 flex items-center gap-1.5 truncate {isRead
                        ? 'text-muted-foreground font-normal'
                        : 'text-foreground font-medium'}"
                >
                    {#if post.is_adult}
                        <Badge variant="destructive" class="shrink-0 px-1.5 py-0 text-[10px]"
                            >19</Badge
                        >
                    {/if}
                    {#if post.is_secret}
                        <Lock class="text-muted-foreground h-4 w-4 shrink-0" />
                    {/if}
                    {post.title}
                </h3>
                <div class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                    <span>👍 {post.likes}</span>
                    <span>💬 {post.comments_count}</span>
                    <span>•</span>
                    <span class="inline-flex items-center gap-0.5"
                        ><LevelBadge
                            level={memberLevelStore.getLevel(post.author_id)}
                            size="sm"
                        /><AuthorLink
                            authorId={post.author_id}
                            authorName={post.author}
                            isWithdrawn={!!post.is_left}
                        /></span
                    >
                    <span>•</span>
                    <span>{formatDate(post.created_at)}</span>
                    <span>•</span>
                    <span>조회 {post.views.toLocaleString()}</span>
                </div>
            </div>

            <!-- 우측: 카테고리 + 태그 -->
            <div class="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                {#if post.category}
                    <span
                        class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[13px] font-medium"
                    >
                        {post.category}
                    </span>
                {/if}
                {#if post.tags && post.tags.length > 0}
                    {#each post.tags.slice(0, 3) as tag (tag)}
                        <Badge variant="secondary" class="rounded-full text-xs">{tag}</Badge>
                    {/each}
                {/if}
            </div>
        </div>
    </a>
{/if}
