<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import ImageIcon from '@lucide/svelte/icons/image';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';

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

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days > 7) {
            return `${date.getMonth() + 1}/${date.getDate()}`;
        } else if (days > 0) {
            return `${days}일 전`;
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 0) return `${hours}시간 전`;
        const minutes = Math.floor(diff / (1000 * 60));
        if (minutes > 0) return `${minutes}분 전`;
        return '방금 전';
    }
</script>

<!-- 포스터 갤러리 레이아웃: 2:3 비율 포스터 카드 -->
<div
    class="group cursor-pointer overflow-hidden rounded-lg transition-all hover:shadow-lg"
    {onclick}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && onclick()}
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
                    target.style.display = 'none';
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
            <h3 class="mb-1 line-clamp-2 text-sm font-medium text-white">
                {post.title}
            </h3>
            <div class="flex items-center gap-1.5 text-xs text-white/70">
                <span class="inline-flex items-center gap-0.5">
                    <LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="sm" />
                    {post.author}
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
                <Badge variant="secondary" class="bg-black/50 text-xs text-white backdrop-blur-sm">
                    {post.category}
                </Badge>
            </div>
        {/if}

        <!-- 댓글 수 배지 (우상단) -->
        {#if post.comments_count > 0}
            <div class="absolute right-2 top-2">
                <Badge variant="secondary" class="bg-black/50 text-xs text-white backdrop-blur-sm">
                    💬 {post.comments_count}
                </Badge>
            </div>
        {/if}
    </div>
</div>

<style>
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
