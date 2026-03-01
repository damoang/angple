<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Lock from '@lucide/svelte/icons/lock';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { formatDate } from '$lib/utils/format-date.js';

    // Props (동일 인터페이스)
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

    const thumbnailUrl = $derived(post.thumbnail || post.images?.[0] || '');
    const hasImage = $derived(Boolean(thumbnailUrl));

    // HTML 태그 제거하여 미리보기 텍스트 생성
    const previewText = $derived(() => {
        if (!post.content) return '';
        const maxLen = displaySettings?.preview_length || 200;
        const stripped = post.content
            .replace(/<[^>]*>/g, '')
            .replace(/&[^;]+;/g, ' ')
            .trim();
        return stripped.length > maxLen ? stripped.slice(0, maxLen) + '…' : stripped;
    });
</script>

<!-- Webzine 레이아웃: 큰 이미지 + 제목 + 본문 미리보기 (블로그/뉴스 스타일) -->
{#if isDeleted}
    <div class="bg-background border-border rounded-lg border px-4 py-3 opacity-50">
        <span class="text-muted-foreground">[삭제된 게시물입니다]</span>
    </div>
{:else}
    <a
        {href}
        class="bg-background border-border hover:border-primary/30 block overflow-hidden rounded-lg border no-underline transition-all hover:shadow-md"
        data-sveltekit-preload-data="hover"
    >
        <div class="flex flex-col sm:flex-row">
            <!-- 썸네일 영역 -->
            {#if hasImage}
                <div class="bg-muted relative h-48 shrink-0 overflow-hidden sm:h-auto sm:w-56">
                    <img
                        src={thumbnailUrl}
                        alt=""
                        class="h-full w-full object-cover"
                        loading="lazy"
                        onerror={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                        }}
                    />
                </div>
            {:else}
                <div
                    class="bg-muted hidden h-auto shrink-0 items-center justify-center overflow-hidden sm:flex sm:w-56"
                >
                    <ImageIcon class="text-muted-foreground h-12 w-12" />
                </div>
            {/if}

            <!-- 콘텐츠 영역 -->
            <div class="flex flex-1 flex-col justify-between p-4">
                <div>
                    <!-- 카테고리 + 제목 -->
                    <div class="mb-2 flex items-center gap-2">
                        {#if post.category}
                            <Badge variant="outline" class="shrink-0 text-xs">
                                {post.category}
                            </Badge>
                        {/if}
                        {#if post.is_adult}
                            <Badge variant="destructive" class="shrink-0 px-1.5 py-0 text-[10px]"
                                >19</Badge
                            >
                        {/if}
                        {#if post.is_secret}
                            <Lock class="text-muted-foreground h-4 w-4 shrink-0" />
                        {/if}
                    </div>

                    <h3
                        class="mb-2 line-clamp-2 text-lg leading-snug {isRead
                            ? 'text-muted-foreground font-normal'
                            : 'text-foreground font-semibold'}"
                    >
                        {post.title}
                    </h3>

                    <!-- 본문 미리보기 -->
                    <p class="text-muted-foreground mb-3 line-clamp-3 text-sm leading-relaxed">
                        {previewText()}
                    </p>
                </div>

                <!-- 하단 메타 정보 -->
                <div class="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                    <span>👍 {post.likes}</span>
                    <span>💬 {post.comments_count}</span>
                    <span class="inline-flex items-center gap-0.5 font-medium"
                        ><LevelBadge
                            level={memberLevelStore.getLevel(post.author_id)}
                            size="sm"
                        />{post.author}</span
                    >
                    <span>{formatDate(post.created_at)}</span>
                    <span>조회 {post.views.toLocaleString()}</span>

                    {#if post.tags && post.tags.length > 0}
                        <div class="flex gap-1">
                            {#each post.tags.slice(0, 3) as tag (tag)}
                                <Badge variant="secondary" class="rounded-full text-[10px]"
                                    >{tag}</Badge
                                >
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
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
    .line-clamp-3 {
        display: -webkit-box;
        line-clamp: 3;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
