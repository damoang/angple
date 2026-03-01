<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Lock from '@lucide/svelte/icons/lock';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { formatDate } from '$lib/utils/format-date.js';

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

    // 썸네일 이미지 추출 (첫 번째 이미지)
    const thumbnailUrl = $derived(post.images && post.images.length > 0 ? post.images[0] : null);
</script>

<!-- Detailed 스킨: 제목 + 본문 미리보기 4-5줄 + 썸네일 + 메타데이터 + 태그 (뉴스 스타일) -->
{#if isDeleted}
    <Card class="bg-background opacity-50">
        <CardContent class="py-4">
            <span class="text-muted-foreground">[삭제된 게시물입니다]</span>
        </CardContent>
    </Card>
{:else}
    <a {href} class="block no-underline" data-sveltekit-preload-data="hover">
        <Card class="bg-background transition-shadow hover:shadow-md">
            <CardHeader>
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                        <CardTitle
                            class="mb-2 flex items-center gap-1.5 {isRead
                                ? 'text-muted-foreground font-normal'
                                : 'text-foreground'}"
                        >
                            {#if post.is_adult}
                                <Badge
                                    variant="destructive"
                                    class="shrink-0 px-1.5 py-0 text-[10px]">19</Badge
                                >
                            {/if}
                            {#if post.is_secret}
                                <Lock class="text-muted-foreground h-4 w-4 shrink-0" />
                            {/if}
                            {post.title}
                        </CardTitle>
                        <div
                            class="text-secondary-foreground flex flex-wrap items-center gap-2 text-[15px]"
                        >
                            <span>👍 {post.likes}</span>
                            <span>💬 {post.comments_count}</span>
                            <span>•</span>
                            <span class="inline-flex items-center gap-0.5"
                                ><LevelBadge
                                    level={memberLevelStore.getLevel(post.author_id)}
                                    size="sm"
                                />{post.author}</span
                            >
                            <span>•</span>
                            <span>{formatDate(post.created_at)}</span>
                            <span>•</span>
                            <span>조회 {post.views.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap gap-1.5">
                        {#if post.category}
                            <span
                                class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[13px] font-medium"
                            >
                                {post.category}
                            </span>
                        {/if}
                        {#if post.tags && post.tags.length > 0}
                            {#each post.tags.slice(0, 3) as tag (tag)}
                                <Badge variant="secondary" class="rounded-full text-xs">{tag}</Badge
                                >
                            {/each}
                        {/if}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div class="flex gap-4">
                    <!-- 좌측: 썸네일 (있을 경우) -->
                    {#if thumbnailUrl && displaySettings?.show_thumbnail !== false}
                        <div
                            class="bg-muted relative h-20 w-20 shrink-0 overflow-hidden rounded-md sm:h-32 sm:w-32"
                        >
                            <img
                                src={thumbnailUrl}
                                alt={post.title}
                                class="h-full w-full object-cover"
                                onerror={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                }}
                            />
                        </div>
                    {/if}

                    <!-- 우측: 본문 미리보기 -->
                    <div class="flex-1">
                        {#if displaySettings?.show_preview !== false}
                            <p class="text-secondary-foreground mb-4 line-clamp-4">
                                {post.content}
                            </p>
                        {/if}
                    </div>
                </div>
            </CardContent>
        </Card>
    </a>
{/if}

<style>
    .line-clamp-4 {
        display: -webkit-box;
        line-clamp: 4;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
