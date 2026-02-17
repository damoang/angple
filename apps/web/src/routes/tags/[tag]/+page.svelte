<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import Tag from '@lucide/svelte/icons/tag';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function goToPage(pageNum: number): void {
        goto(`/tags/${encodeURIComponent(data.tag)}?page=${pageNum}`);
    }
</script>

<svelte:head>
    <title>#{data.tag} 태그 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <div class="mb-6 flex items-center gap-3">
        <Tag class="h-6 w-6" />
        <h1 class="text-foreground text-2xl font-bold">
            <Badge variant="secondary" class="mr-2 text-lg">#{data.tag}</Badge>
            태그
        </h1>
        {#if data.posts.total > 0}
            <span class="text-muted-foreground text-sm">
                {data.posts.total.toLocaleString()}개의 게시글
            </span>
        {/if}
    </div>

    {#if data.posts.items.length > 0}
        <Card class="bg-background">
            <CardContent class="pt-6">
                <ul class="divide-border divide-y">
                    {#each data.posts.items as post (post.id)}
                        <li class="py-3 first:pt-0 last:pb-0">
                            <a
                                href="/free/{post.id}"
                                class="hover:bg-accent -m-2 block rounded-md p-2 transition-colors"
                            >
                                <h3 class="text-foreground mb-1 line-clamp-1 font-medium">
                                    {post.title}
                                </h3>
                                <div class="text-muted-foreground flex items-center gap-2 text-xs">
                                    <span>{post.author}</span>
                                    <span>·</span>
                                    <span>{formatDate(post.created_at)}</span>
                                    <span>·</span>
                                    <span>조회 {post.views.toLocaleString()}</span>
                                    <span>·</span>
                                    <span>추천 {post.likes}</span>
                                    <span>·</span>
                                    <span>댓글 {post.comments_count}</span>
                                </div>
                                {#if post.tags && post.tags.length > 0}
                                    <div class="mt-2 flex flex-wrap gap-1">
                                        {#each post.tags as tag (tag)}
                                            <Badge
                                                variant={tag === data.tag ? 'default' : 'secondary'}
                                                class="text-xs"
                                            >
                                                #{tag}
                                            </Badge>
                                        {/each}
                                    </div>
                                {/if}
                            </a>
                        </li>
                    {/each}
                </ul>
            </CardContent>
        </Card>

        <!-- 페이지네이션 -->
        {#if data.posts.total_pages > 1}
            <div class="mt-6 flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                >
                    이전
                </Button>
                <span class="text-muted-foreground px-4 text-sm">
                    {data.page} / {data.posts.total_pages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === data.posts.total_pages}
                    onclick={() => goToPage(data.page + 1)}
                >
                    다음
                </Button>
            </div>
        {/if}
    {:else}
        <Card class="bg-background">
            <CardContent class="pt-6">
                <p class="text-muted-foreground py-8 text-center">
                    #{data.tag} 태그의 게시글이 없습니다.
                </p>
            </CardContent>
        </Card>
    {/if}
</div>
