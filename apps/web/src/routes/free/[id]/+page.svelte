<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { PageData } from './$types.js';
    import { NeoKeyButton } from '$lib/components/ui/neo-key-button/index.js';
    import Heart from '@lucide/svelte/icons/heart';

    let { data }: { data: PageData } = $props();

    // 날짜 포맷 헬퍼
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 목록으로 돌아가기
    function goBack(): void {
        goto('/free');
    }

    let isLiked = $state(false);
</script>

<svelte:head>
    <title>{data.post.title} - 자유게시판 | 다모앙</title>
    <meta name="description" content={data.post.content.slice(0, 150)} />
</svelte:head>

<div class="mx-auto pt-2">
    <!-- 상단 네비게이션 -->
    <div class="mb-6">
        <Button variant="outline" size="sm" onclick={goBack}>← 목록으로</Button>
    </div>

    <!-- 게시글 헤더 -->
    <Card class="bg-background mb-6">
        <CardHeader class="space-y-3">
            <div>
                {#if data.post.tags && data.post.tags.length > 0}
                    <div class="mb-3 flex flex-wrap gap-2">
                        {#each data.post.tags as tag (tag)}
                            <Badge variant="secondary">{tag}</Badge>
                        {/each}
                    </div>
                {/if}
                <CardTitle class="text-foreground text-3xl">{data.post.title}</CardTitle>
            </div>

            <div class="border-border flex flex-wrap items-center gap-4 border-t pt-4">
                <div class="flex items-center gap-2">
                    <div
                        class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full"
                    >
                        {data.post.author.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="text-foreground font-medium">{data.post.author}</p>
                        <p class="text-secondary-foreground text-sm">
                            {formatDate(data.post.created_at)}
                        </p>
                    </div>
                </div>

                <div class="text-secondary-foreground ml-auto flex gap-4 text-sm">
                    <span>조회 {data.post.views.toLocaleString()}</span>
                    <span>👍 {data.post.likes.toLocaleString()}</span>
                    <span>💬 {data.post.comments_count.toLocaleString()}</span>
                </div>
            </div>

            <!-- 게시글 본문 -->

            <div class="text-foreground mt-8 whitespace-pre-wrap">
                {data.post.content}
            </div>

            {#if data.post.images && data.post.images.length > 0}
                <div class="mt-6 grid gap-4">
                    {#each data.post.images as image (image)}
                        <img
                            src={image}
                            alt="게시글 이미지"
                            class="rounded-lg border"
                            loading="lazy"
                        />
                    {/each}
                </div>
            {/if}
            <div class="mb-3 mt-8">
                <div class="border-border flex w-fit items-center rounded-[7px] border">
                    <NeoKeyButton
                        bind:liked={isLiked}
                        size="sm"
                        class="text-dusty-700 justify-start"
                    >
                        {#if isLiked}
                            <Heart class="!h-6 !w-6 fill-red-500 text-red-500" />
                        {:else}
                            <Heart class="dark:text-dusty-400 !h-6 !w-6" />
                        {/if}
                    </NeoKeyButton>
                    <!-- 좋아요 개수 -->
                    <span class="block px-4 text-sm font-semibold">
                        {isLiked ? data.post.likes + 1 : data.post.likes}
                    </span>
                </div>
            </div>
        </CardHeader>
    </Card>

    <!-- 하단 액션 버튼 -->
    <!-- <div class="mt-4 flex items-center justify-between">
        <Button variant="outline" onclick={goBack}>← 목록으로</Button>

        <div class="flex gap-2">
            <Button variant="outline" size="sm">
                👍 좋아요 {data.post.likes}
            </Button>
            <Button variant="outline" size="sm">
                💬 댓글 {data.post.comments_count}
            </Button>
        </div>
    </div> -->

    <!-- 수정/삭제 시간 표시 -->
    {#if data.post.updated_at !== data.post.created_at}
        <p class="text-muted-foreground mt-4 text-center text-sm">
            마지막 수정: {formatDate(data.post.updated_at)}
        </p>
    {/if}

    <Card class="bg-background ">
        <CardHeader>
            <p>댓글</p>
            <ul>
                {#each data.comments.items as comment (comment.id)}
                    <li
                        style="margin-left: {comment.depth * 1.25}rem"
                        class="{comment.depth
                            ? 'reply'
                            : 'parent'} border-border border-b pb-2 pt-2 last:border-none"
                    >
                        <div class="mb-2 flex flex-wrap items-center gap-4">
                            <div class="flex items-center gap-2">
                                <div
                                    class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full"
                                >
                                    {comment.author.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p class="text-foreground font-medium">{comment.author}</p>
                                    <p class="text-secondary-foreground text-sm">
                                        {formatDate(comment.created_at)}
                                    </p>
                                </div>
                            </div>

                            <div class="text-secondary-foreground ml-auto flex gap-4 text-sm">
                                <span>👍 {comment.likes.toLocaleString()}</span>
                            </div>
                        </div>
                        <div>{comment.content}</div>
                    </li>
                {/each}
            </ul>
        </CardHeader>
    </Card>
</div>

<style>
    .prose {
        font-size: 1rem;
        line-height: 1.75;
    }
</style>
