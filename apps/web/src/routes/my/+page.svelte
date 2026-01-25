<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { PageData } from './$types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import FileText from '@lucide/svelte/icons/file-text';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Heart from '@lucide/svelte/icons/heart';
    import User from '@lucide/svelte/icons/user';
    import Settings from '@lucide/svelte/icons/settings';
    import Coins from '@lucide/svelte/icons/coins';
    import Star from '@lucide/svelte/icons/star';

    let { data }: { data: PageData } = $props();

    // 탭 정의
    const tabs = [
        { id: 'posts', label: '내가 쓴 글', icon: FileText },
        { id: 'comments', label: '내가 쓴 댓글', icon: MessageSquare },
        { id: 'liked', label: '추천한 글', icon: Heart }
    ];

    // 탭 변경
    function changeTab(tabId: string): void {
        goto(`/my?tab=${tabId}`);
    }

    // 페이지 변경
    function goToPage(pageNum: number): void {
        goto(`/my?tab=${data.tab}&page=${pageNum}`);
    }

    // 게시글로 이동
    function goToPost(boardId: string, postId: number): void {
        goto(`/${boardId}/${postId}`);
    }

    // 날짜 포맷
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    // 현재 페이지네이션 데이터
    const pagination = $derived(() => {
        if (data.tab === 'posts' && data.posts) {
            return data.posts;
        } else if (data.tab === 'comments' && data.comments) {
            return data.comments;
        } else if (data.tab === 'liked' && data.likedPosts) {
            return data.likedPosts;
        }
        return null;
    });
</script>

<svelte:head>
    <title>마이페이지 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <!-- 헤더 -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
            <!-- 프로필 아바타 -->
            {#if authStore.user}
                <div
                    class="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold"
                >
                    {authStore.user.mb_name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <h1 class="text-2xl font-bold text-foreground">{authStore.user.mb_name}</h1>
                    <p class="text-secondary-foreground">Lv.{authStore.user.mb_level}</p>
                </div>
            {:else}
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <User class="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                    <h1 class="text-2xl font-bold text-foreground">마이페이지</h1>
                </div>
            {/if}
        </div>

        <div class="flex gap-2">
            <Button variant="outline" size="sm" onclick={() => goto('/my/points')}>
                <Coins class="mr-1 h-4 w-4" />
                포인트
            </Button>
            <Button variant="outline" size="sm" onclick={() => goto('/my/exp')}>
                <Star class="mr-1 h-4 w-4" />
                경험치
            </Button>
            <Button variant="outline" size="sm" onclick={() => goto('/my/blocked')}>
                차단 목록
            </Button>
            <Button variant="outline" size="sm" onclick={() => goto('/my/settings')}>
                <Settings class="mr-1 h-4 w-4" />
                설정
            </Button>
        </div>
    </div>

    <!-- 탭 네비게이션 -->
    <div class="mb-6 flex gap-2 border-b border-border pb-2">
        {#each tabs as tab (tab.id)}
            <Button
                variant={data.tab === tab.id ? 'default' : 'ghost'}
                size="sm"
                onclick={() => changeTab(tab.id)}
            >
                <tab.icon class="mr-1.5 h-4 w-4" />
                {tab.label}
            </Button>
        {/each}
    </div>

    <!-- 에러 메시지 -->
    {#if data.error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{data.error}</p>
            </CardContent>
        </Card>
    {:else}
        <!-- 내가 쓴 글 -->
        {#if data.tab === 'posts'}
            <Card class="bg-background">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <FileText class="h-5 w-5" />
                        내가 쓴 글
                        {#if data.posts}
                            <span class="text-sm font-normal text-muted-foreground">
                                ({data.posts.total}개)
                            </span>
                        {/if}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {#if data.posts && data.posts.items.length > 0}
                        <ul class="divide-y divide-border">
                            {#each data.posts.items as post (post.id)}
                                <li class="py-3 first:pt-0 last:pb-0">
                                    <button
                                        type="button"
                                        onclick={() => goToPost('free', post.id)}
                                        class="w-full text-left hover:bg-accent rounded-md p-2 -m-2 transition-colors"
                                    >
                                        <h3 class="text-foreground font-medium line-clamp-1 mb-1">
                                            {post.title}
                                        </h3>
                                        <div class="text-muted-foreground text-xs flex items-center gap-2">
                                            <span>{formatDate(post.created_at)}</span>
                                            <span>•</span>
                                            <span>조회 {post.views.toLocaleString()}</span>
                                            <span>•</span>
                                            <span>👍 {post.likes}</span>
                                            <span>•</span>
                                            <span>💬 {post.comments_count}</span>
                                        </div>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {:else}
                        <p class="text-center text-muted-foreground py-8">
                            작성한 글이 없습니다.
                        </p>
                    {/if}
                </CardContent>
            </Card>
        {/if}

        <!-- 내가 쓴 댓글 -->
        {#if data.tab === 'comments'}
            <Card class="bg-background">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <MessageSquare class="h-5 w-5" />
                        내가 쓴 댓글
                        {#if data.comments}
                            <span class="text-sm font-normal text-muted-foreground">
                                ({data.comments.total}개)
                            </span>
                        {/if}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {#if data.comments && data.comments.items.length > 0}
                        <ul class="divide-y divide-border">
                            {#each data.comments.items as comment (comment.id)}
                                <li class="py-3 first:pt-0 last:pb-0">
                                    <div class="rounded-md p-2 -m-2">
                                        <p class="text-foreground line-clamp-2 mb-2">
                                            {comment.content}
                                        </p>
                                        <div class="text-muted-foreground text-xs flex items-center gap-2">
                                            <span>{formatDate(comment.created_at)}</span>
                                            {#if comment.likes}
                                                <span>•</span>
                                                <span>👍 {comment.likes}</span>
                                            {/if}
                                        </div>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {:else}
                        <p class="text-center text-muted-foreground py-8">
                            작성한 댓글이 없습니다.
                        </p>
                    {/if}
                </CardContent>
            </Card>
        {/if}

        <!-- 추천한 글 -->
        {#if data.tab === 'liked'}
            <Card class="bg-background">
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Heart class="h-5 w-5" />
                        추천한 글
                        {#if data.likedPosts}
                            <span class="text-sm font-normal text-muted-foreground">
                                ({data.likedPosts.total}개)
                            </span>
                        {/if}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {#if data.likedPosts && data.likedPosts.items.length > 0}
                        <ul class="divide-y divide-border">
                            {#each data.likedPosts.items as post (post.id)}
                                <li class="py-3 first:pt-0 last:pb-0">
                                    <button
                                        type="button"
                                        onclick={() => goToPost('free', post.id)}
                                        class="w-full text-left hover:bg-accent rounded-md p-2 -m-2 transition-colors"
                                    >
                                        <h3 class="text-foreground font-medium line-clamp-1 mb-1">
                                            {post.title}
                                        </h3>
                                        <div class="text-muted-foreground text-xs flex items-center gap-2">
                                            <span>{post.author}</span>
                                            <span>•</span>
                                            <span>{formatDate(post.created_at)}</span>
                                            <span>•</span>
                                            <span>👍 {post.likes}</span>
                                        </div>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    {:else}
                        <p class="text-center text-muted-foreground py-8">
                            추천한 글이 없습니다.
                        </p>
                    {/if}
                </CardContent>
            </Card>
        {/if}

        <!-- 페이지네이션 -->
        {#if pagination() && pagination()!.total_pages > 1}
            <div class="mt-6 flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                >
                    이전
                </Button>

                <span class="text-sm text-muted-foreground px-4">
                    {data.page} / {pagination()!.total_pages}
                </span>

                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === pagination()!.total_pages}
                    onclick={() => goToPage(data.page + 1)}
                >
                    다음
                </Button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
