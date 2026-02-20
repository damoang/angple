<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import ImageIcon from '@lucide/svelte/icons/image';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { formatDate } from '$lib/utils/format-date.js';

    // Props (동일 인터페이스)
    let {
        post,
        displaySettings,
        onclick
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        onclick: () => void;
    } = $props();

    const thumbnailUrl = $derived(post.thumbnail || post.images?.[0] || '');
    const hasImage = $derived(Boolean(thumbnailUrl));
</script>

<!-- Gallery 레이아웃: 썸네일 중심 카드 (그리드 아이템) -->
<div
    class="bg-background border-border hover:border-primary/30 group cursor-pointer overflow-hidden rounded-lg border transition-all hover:shadow-md"
    {onclick}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && onclick()}
>
    <!-- 썸네일 영역 -->
    <div class="bg-muted relative aspect-video overflow-hidden">
        {#if hasImage}
            <img
                src={thumbnailUrl}
                alt=""
                class="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
                onerror={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
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
        {#if post.comments_count > 0}
            <div class="absolute bottom-2 right-2">
                <Badge variant="secondary" class="bg-background/80 text-xs backdrop-blur-sm">
                    💬 {post.comments_count}
                </Badge>
            </div>
        {/if}
    </div>

    <!-- 정보 영역 -->
    <div class="p-3">
        <h3 class="text-foreground mb-1.5 truncate text-sm font-medium">
            {post.title}
        </h3>
        <div class="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span>👍 {post.likes}</span>
            <span>·</span>
            <span class="inline-flex items-center gap-0.5"
                ><LevelBadge
                    level={memberLevelStore.getLevel(post.author_id)}
                    size="sm"
                />{post.author}</span
            >
            <span>·</span>
            <span>{formatDate(post.created_at)}</span>
        </div>
    </div>
</div>
