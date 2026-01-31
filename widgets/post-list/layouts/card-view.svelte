<script lang="ts">
    /**
     * 카드형 레이아웃
     */
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';

    interface Post {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: string;
        created_at?: string;
        comment_count?: number;
        view_count?: number;
        recommend_count?: number;
    }

    let {
        posts = [],
        showTitle = true,
        boardId = ''
    }: {
        posts: Post[];
        showTitle?: boolean;
        boardId?: string;
    } = $props();

    const boardLabels: Record<string, string> = {
        notice: '새소식',
        economy: '알뜰구매',
        gallery: '갤러리',
        group: '소모임',
        free: '자유게시판'
    };

    function formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffH = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffH < 1) return '방금 전';
        if (diffH < 24) return `${diffH}시간 전`;
        const diffD = Math.floor(diffH / 24);
        if (diffD < 7) return `${diffD}일 전`;
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
</script>

<Card class="gap-0">
    {#if showTitle}
        <CardHeader class="px-4 py-2.5">
            <h3 class="text-sm font-semibold">{boardLabels[boardId] ?? boardId}</h3>
        </CardHeader>
    {/if}
    <CardContent class="px-4 pb-3">
        {#if posts.length === 0}
            <p class="text-muted-foreground py-4 text-center text-sm">게시글이 없습니다.</p>
        {:else}
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {#each posts as post (post.id)}
                    <a
                        href={post.url ?? '#'}
                        class="border-border group overflow-hidden rounded-xl border transition-shadow hover:shadow-md"
                    >
                        {#if post.thumbnail_url}
                            <div class="bg-muted aspect-video overflow-hidden">
                                <img
                                    src={post.thumbnail_url}
                                    alt={post.title}
                                    class="h-full w-full object-cover transition-transform group-hover:scale-105"
                                    loading="lazy"
                                />
                            </div>
                        {/if}
                        <div class="p-3">
                            <h4 class="line-clamp-2 text-sm font-medium">{post.title}</h4>
                            <div class="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                                {#if post.author}
                                    <span>{post.author}</span>
                                {/if}
                                {#if post.created_at}
                                    <span>{formatDate(post.created_at)}</span>
                                {/if}
                                {#if post.comment_count}
                                    <span class="text-primary">💬 {post.comment_count}</span>
                                {/if}
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        {/if}
    </CardContent>
</Card>
