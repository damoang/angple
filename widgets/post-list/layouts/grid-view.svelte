<script lang="ts">
    /**
     * 그리드형 레이아웃
     */
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';

    interface Post {
        id: number;
        title: string;
        url?: string;
        author?: string;
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
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {#each posts as post (post.id)}
                    <a
                        href={post.url ?? '#'}
                        class="border-border hover:bg-accent flex items-center gap-2 rounded-lg border p-3 transition-colors"
                    >
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm">{post.title}</p>
                            {#if post.author}
                                <p class="text-muted-foreground mt-0.5 text-xs">{post.author}</p>
                            {/if}
                        </div>
                        {#if post.recommend_count}
                            <span
                                class="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                            >
                                👍 {post.recommend_count}
                            </span>
                        {/if}
                    </a>
                {/each}
            </div>
        {/if}
    </CardContent>
</Card>
