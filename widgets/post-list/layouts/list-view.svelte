<script lang="ts">
    /**
     * 목록형 레이아웃
     */
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';

    interface Post {
        id: number;
        title: string;
        url?: string;
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
            <ul class="divide-border divide-y">
                {#each posts as post (post.id)}
                    <li class="py-2">
                        <a
                            href={post.url ?? `#`}
                            class="hover:text-primary flex items-center justify-between gap-2 text-sm transition-colors"
                        >
                            <span class="min-w-0 flex-1 truncate">{post.title}</span>
                            <span
                                class="text-muted-foreground flex shrink-0 items-center gap-2 text-xs"
                            >
                                {#if post.comment_count}
                                    <span class="text-primary font-medium"
                                        >[{post.comment_count}]</span
                                    >
                                {/if}
                                {#if post.author}
                                    <span>{post.author}</span>
                                {/if}
                            </span>
                        </a>
                    </li>
                {/each}
            </ul>
        {/if}
    </CardContent>
</Card>
