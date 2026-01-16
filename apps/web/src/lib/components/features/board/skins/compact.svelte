<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';

    // Props
    let {
        post,
        displaySettings,
        onclick
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        onclick: () => void;
    } = $props();

    // 날짜 포맷 헬퍼
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 7) {
            return date.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } else if (days > 0) {
            return `${days}일 전`;
        } else if (hours > 0) {
            return `${hours}시간 전`;
        } else if (minutes > 0) {
            return `${minutes}분 전`;
        } else {
            return '방금 전';
        }
    }
</script>

<!-- Compact 스킨: 제목 + 메타데이터 + 태그만 (심플) -->
<div
    class="bg-background border-border hover:bg-accent cursor-pointer rounded-lg border px-4 py-3 transition-all hover:shadow-sm"
    {onclick}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && onclick()}
>
    <div class="flex items-center justify-between gap-4">
        <!-- 좌측: 제목 + 메타데이터 -->
        <div class="min-w-0 flex-1">
            <h3 class="text-foreground mb-1 truncate font-medium">
                {post.title}
            </h3>
            <div class="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span>{post.author}</span>
                <span>•</span>
                <span>{formatDate(post.created_at)}</span>
                <span>•</span>
                <span>조회 {post.views.toLocaleString()}</span>
                <span>•</span>
                <span>👍 {post.likes}</span>
                <span>•</span>
                <span>💬 {post.comments_count}</span>
            </div>
        </div>

        <!-- 우측: 카테고리 + 태그 -->
        <div class="flex flex-shrink-0 flex-wrap items-center gap-1.5">
            {#if post.category}
                <span class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-medium">
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
</div>
