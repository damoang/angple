<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import type { FreePost } from '$lib/api/types.js';

    // Props
    let { post, onclick }: { post: FreePost; onclick: () => void } = $props();

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

<!-- Card 스킨: 제목 + 본문 미리보기 2줄 + 메타데이터 + 태그 -->
<Card class="bg-background cursor-pointer transition-shadow hover:shadow-md" {onclick}>
    <CardHeader>
        <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
                <CardTitle class="text-foreground mb-2 truncate">
                    {post.title}
                </CardTitle>
                <div class="text-secondary-foreground flex flex-wrap items-center gap-2 text-sm">
                    <span>{post.author}</span>
                    <span>•</span>
                    <span>{formatDate(post.created_at)}</span>
                    <span>•</span>
                    <span>조회 {post.views.toLocaleString()}</span>
                </div>
            </div>
            <div class="flex flex-shrink-0 flex-wrap gap-1.5">
                {#if post.category}
                    <span
                        class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-medium"
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
    </CardHeader>
    <CardContent>
        <p class="text-secondary-foreground mb-4 line-clamp-2">
            {post.content}
        </p>
        <div class="text-secondary-foreground flex items-center gap-4 text-sm">
            <span>👍 {post.likes}</span>
            <span>💬 {post.comments_count}</span>
        </div>
    </CardContent>
</Card>

<style>
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
