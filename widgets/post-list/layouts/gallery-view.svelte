<script lang="ts">
    /**
     * 갤러리형 레이아웃
     */
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';

    interface Post {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: string;
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
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {#each posts as post (post.id)}
                    <a href={post.url ?? '#'} class="group block">
                        <div class="bg-muted aspect-square overflow-hidden rounded-lg">
                            {#if post.thumbnail_url}
                                <img
                                    src={post.thumbnail_url}
                                    alt={post.title}
                                    class="h-full w-full object-cover transition-transform group-hover:scale-105"
                                    loading="lazy"
                                />
                            {:else}
                                <div
                                    class="text-muted-foreground flex h-full items-center justify-center text-xs"
                                >
                                    No Image
                                </div>
                            {/if}
                        </div>
                        <p class="mt-1.5 truncate text-xs">{post.title}</p>
                        {#if post.comment_count}
                            <span class="text-primary text-xs font-medium"
                                >[{post.comment_count}]</span
                            >
                        {/if}
                    </a>
                {/each}
            </div>
        {/if}
    </CardContent>
</Card>
