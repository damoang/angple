<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Skeleton } from '$lib/components/ui/skeleton/index.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

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

    // 페이지 이동
    function goToPage(page: number): void {
        goto(`/free?page=${page}&limit=${data.pagination.limit}`);
    }

    // 게시글 상세 페이지로 이동
    function goToPost(id: string): void {
        goto(`/free/${id}`);
    }
</script>

<svelte:head>
    <title>자유게시판 | 다모앙</title>
</svelte:head>

<div class="mx-auto pt-4">
    <!-- 헤더 -->
    <div class="mb-8">
        <h1 class="text-foreground mb-2 text-3xl font-bold">자유게시판</h1>
        <p class="text-secondary-foreground">다모앙 커뮤니티의 자유로운 소통 공간입니다.</p>
    </div>

    <!-- 에러 메시지 -->
    {#if data.error}
        <Card class="border-destructive mb-6">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{data.error}</p>
            </CardContent>
        </Card>
    {/if}

    <!-- 게시글 목록 -->
    <div class="space-y-4">
        {#if data.posts.length === 0}
            <Card class="bg-background">
                <CardContent class="py-12 text-center">
                    <p class="text-secondary-foreground">게시글이 없습니다.</p>
                </CardContent>
            </Card>
        {:else}
            {#each data.posts as post}
                <Card
                    class="bg-background hover:shadow-md transition-shadow cursor-pointer"
                    onclick={() => goToPost(post.id)}
                >
                    <CardHeader>
                        <div class="flex items-start justify-between gap-4">
                            <div class="flex-1 min-w-0">
                                <CardTitle class="text-foreground mb-2 truncate"
                                    >{post.title}</CardTitle
                                >
                                <div
                                    class="text-secondary-foreground flex flex-wrap items-center gap-2 text-sm"
                                >
                                    <span>{post.author}</span>
                                    <span>•</span>
                                    <span>{formatDate(post.created_at)}</span>
                                    <span>•</span>
                                    <span>조회 {post.views.toLocaleString()}</span>
                                </div>
                            </div>
                            {#if post.tags && post.tags.length > 0}
                                <div class="flex flex-wrap gap-1">
                                    {#each post.tags.slice(0, 3) as tag}
                                        <Badge variant="secondary" class="text-xs">{tag}</Badge>
                                    {/each}
                                </div>
                            {/if}
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
            {/each}
        {/if}
    </div>

    <!-- 페이지네이션 -->
    {#if data.pagination.totalPages > 1}
        <div class="mt-8 flex items-center justify-center gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page === 1}
                onclick={() => goToPage(data.pagination.page - 1)}
            >
                이전
            </Button>

            {#each Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                const startPage = Math.max(1, data.pagination.page - 2);
                return startPage + i;
            }) as pageNum}
                {#if pageNum <= data.pagination.totalPages}
                    <Button
                        variant={pageNum === data.pagination.page ? 'default' : 'outline'}
                        size="sm"
                        onclick={() => goToPage(pageNum)}
                    >
                        {pageNum}
                    </Button>
                {/if}
            {/each}

            <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page === data.pagination.totalPages}
                onclick={() => goToPage(data.pagination.page + 1)}
            >
                다음
            </Button>
        </div>

        <p class="text-secondary-foreground mt-4 text-center text-sm">
            전체 {data.pagination.total.toLocaleString()}개 중 {data.pagination.page} / {data
                .pagination.totalPages} 페이지
        </p>
    {/if}
</div>

<style>
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
