<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Progress } from '$lib/components/ui/progress/index.js';
    import type { PageData } from './$types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { getGradeName } from '$lib/utils/grade.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import MySkeleton from '$lib/components/features/my/my-skeleton.svelte';
    import FileText from '@lucide/svelte/icons/file-text';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Heart from '@lucide/svelte/icons/heart';
    import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
    import User from '@lucide/svelte/icons/user';

    let { data }: { data: PageData } = $props();

    let myAvatarUrl = $derived(getAvatarUrl(authStore.user?.mb_image) || null);
    let myAvatarFailed = $state(false);

    $effect(() => {
        if (authStore.user) myAvatarFailed = false;
    });

    // 탭 정의
    const tabs = [
        { id: 'posts', label: '내가 쓴 글', icon: FileText },
        { id: 'comments', label: '내가 쓴 댓글', icon: MessageSquare },
        { id: 'liked', label: '공감한 글', icon: Heart },
        { id: 'stats', label: '전체분석', icon: BarChart3 }
    ];

    // 탭 변경
    function changeTab(tabId: string): void {
        goto(`/my?tab=${tabId}`);
    }

    // 페이지 변경
    function goToPage(pageNum: number): void {
        goto(`/my?tab=${data.tab}&page=${pageNum}`);
    }

    // 날짜 포맷
    function stripHtml(html: string): string {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .trim();
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

<svelte:head>
    <title>마이페이지 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4">
    <!-- 헤더 (즉시 렌더링: locals.user에서 옴) -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
            {#if authStore.user}
                <div
                    class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold {myAvatarUrl &&
                    !myAvatarFailed
                        ? 'overflow-hidden'
                        : 'bg-primary text-primary-foreground'}"
                >
                    {#if myAvatarUrl && !myAvatarFailed}
                        <img
                            src={myAvatarUrl}
                            alt={authStore.user.mb_name}
                            class="h-full w-full object-cover"
                            onerror={() => {
                                myAvatarFailed = true;
                            }}
                        />
                    {:else}
                        {authStore.user.mb_name.charAt(0).toUpperCase()}
                    {/if}
                </div>
                <div>
                    <h1 class="text-foreground text-2xl font-bold">{authStore.user.mb_name}</h1>
                    <p class="text-secondary-foreground">{getGradeName(authStore.user.mb_level)}</p>
                    <!-- 경험치 게이지: 스트리밍 데이터 도착 후 표시 -->
                    {#await data.streamed?.tabData then result}
                        {#if result.expSummary}
                            <div class="mt-1 w-48">
                                <div
                                    class="text-muted-foreground mb-0.5 flex items-center justify-between text-xs"
                                >
                                    <span>Lv.{result.expSummary.current_level}</span>
                                    <span>{result.expSummary.level_progress}%</span>
                                </div>
                                <Progress
                                    value={result.expSummary.level_progress}
                                    max={100}
                                    class="h-2"
                                />
                                <p class="text-muted-foreground mt-0.5 text-xs">
                                    {result.expSummary.total_exp.toLocaleString()} / {result.expSummary.next_level_exp.toLocaleString()}
                                    XP
                                </p>
                            </div>
                        {/if}
                    {/await}
                </div>
            {:else}
                <div class="bg-muted flex h-16 w-16 items-center justify-center rounded-full">
                    <User class="text-muted-foreground h-8 w-8" />
                </div>
                <div>
                    <h1 class="text-foreground text-2xl font-bold">마이페이지</h1>
                </div>
            {/if}
        </div>
    </div>

    <!-- 탭 네비게이션 (즉시 렌더링) -->
    <div class="border-border mb-6 flex gap-2 border-b pb-2">
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

    <!-- 탭 콘텐츠 (스트리밍) -->
    {#await data.streamed?.tabData}
        <!-- 스켈레톤 -->
        <MySkeleton />
    {:then result}
        <!-- 에러 메시지 -->
        {#if result.error}
            <Card class="border-destructive">
                <CardContent class="pt-6">
                    <p class="text-destructive text-center">{result.error}</p>
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
                            {#if result.posts}
                                <span class="text-muted-foreground text-sm font-normal">
                                    ({result.posts.total}개)
                                </span>
                            {/if}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.posts && result.posts.items.length > 0}
                            <ul class="divide-border divide-y">
                                {#each result.posts.items as post (post.id)}
                                    <li class="py-3 first:pt-0 last:pb-0">
                                        <a
                                            href="/{post.board_id || 'free'}/{post.id}"
                                            class="hover:bg-accent -m-2 block w-full rounded-md p-2 no-underline transition-colors"
                                        >
                                            <h3
                                                class="text-foreground mb-1 line-clamp-1 font-medium"
                                            >
                                                {post.title}
                                            </h3>
                                            <div
                                                class="text-muted-foreground flex items-center gap-2 text-xs"
                                            >
                                                <span>{formatDate(post.created_at)}</span>
                                                <span>·</span>
                                                <span>조회 {post.views.toLocaleString()}</span>
                                                <span>·</span>
                                                <span>공감 {post.likes}</span>
                                                <span>·</span>
                                                <span>댓글 {post.comments_count}</span>
                                            </div>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                작성한 글이 없습니다.
                            </p>
                        {/if}
                    </CardContent>
                </Card>

                <!-- 페이지네이션 -->
                {#if result.posts && result.posts.total_pages > 1}
                    {@const pag = result.posts}
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
                            {data.page} / {pag.total_pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === pag.total_pages}
                            onclick={() => goToPage(data.page + 1)}
                        >
                            다음
                        </Button>
                    </div>
                {/if}
            {/if}

            <!-- 내가 쓴 댓글 -->
            {#if data.tab === 'comments'}
                <Card class="bg-background">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <MessageSquare class="h-5 w-5" />
                            내가 쓴 댓글
                            {#if result.comments}
                                <span class="text-muted-foreground text-sm font-normal">
                                    ({result.comments.total}개)
                                </span>
                            {/if}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.comments && result.comments.items.length > 0}
                            <ul class="divide-border divide-y">
                                {#each result.comments.items as comment (`${comment.board_id}-${comment.id}`)}
                                    <li class="py-3 first:pt-0 last:pb-0">
                                        <a
                                            href="/{comment.board_id || 'free'}/{comment.post_id ||
                                                comment.parent_id}"
                                            class="hover:bg-accent -m-2 block rounded-md p-2 no-underline transition-colors"
                                        >
                                            {#if comment.post_title}
                                                <p
                                                    class="text-muted-foreground mb-1 line-clamp-1 text-xs"
                                                >
                                                    {comment.post_title}
                                                </p>
                                            {/if}
                                            <p class="text-foreground mb-2 line-clamp-2">
                                                {stripHtml(comment.content)}
                                            </p>
                                            <div
                                                class="text-muted-foreground flex items-center gap-2 text-xs"
                                            >
                                                <span>{formatDate(comment.created_at)}</span>
                                                {#if comment.likes}
                                                    <span>·</span>
                                                    <span>공감 {comment.likes}</span>
                                                {/if}
                                            </div>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                작성한 댓글이 없습니다.
                            </p>
                        {/if}
                    </CardContent>
                </Card>

                {#if result.comments && result.comments.total_pages > 1}
                    {@const pag = result.comments}
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
                            {data.page} / {pag.total_pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === pag.total_pages}
                            onclick={() => goToPage(data.page + 1)}
                        >
                            다음
                        </Button>
                    </div>
                {/if}
            {/if}

            <!-- 공감한 글 -->
            {#if data.tab === 'liked'}
                <Card class="bg-background">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <Heart class="h-5 w-5" />
                            공감한 글
                            {#if result.likedPosts}
                                <span class="text-muted-foreground text-sm font-normal">
                                    ({result.likedPosts.total}개)
                                </span>
                            {/if}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.likedPosts && result.likedPosts.items.length > 0}
                            <ul class="divide-border divide-y">
                                {#each result.likedPosts.items as post (post.id)}
                                    <li>
                                        <a
                                            href="/{post.board_id || 'free'}/{post.id}"
                                            class="hover:bg-muted flex items-center gap-2.5 px-4 py-2 no-underline transition-all duration-200 ease-out"
                                        >
                                            <span
                                                class="bg-muted text-muted-foreground hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline-block"
                                            >
                                                {post.board_name || post.board_id || 'free'}
                                            </span>
                                            <span class="min-w-0 flex-1 truncate leading-relaxed">
                                                {post.title}
                                            </span>
                                            <span
                                                class="text-muted-foreground hidden shrink-0 items-center gap-3 text-xs sm:flex"
                                            >
                                                <span>{post.author}</span>
                                                <span>{formatDate(post.created_at)}</span>
                                            </span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                공감한 글이 없습니다.
                            </p>
                        {/if}
                    </CardContent>
                </Card>

                {#if result.likedPosts && result.likedPosts.total_pages > 1}
                    {@const pag = result.likedPosts}
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
                            {data.page} / {pag.total_pages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={data.page === pag.total_pages}
                            onclick={() => goToPage(data.page + 1)}
                        >
                            다음
                        </Button>
                    </div>
                {/if}
            {/if}

            <!-- 전체분석 -->
            {#if data.tab === 'stats'}
                <Card class="bg-background">
                    <CardHeader>
                        <CardTitle class="flex items-center gap-2">
                            <BarChart3 class="h-5 w-5" />
                            전체분석
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {#if result.boardStats && result.boardStats.length > 0}
                            <div class="divide-border divide-y">
                                {#each result.boardStats as stat (stat.board_id)}
                                    <div class="flex items-center justify-between py-3">
                                        <a
                                            href="/{stat.board_id}"
                                            class="text-foreground font-medium hover:underline"
                                        >
                                            {stat.board_name}
                                        </a>
                                        <div class="text-muted-foreground flex gap-4 text-sm">
                                            <span>글 {stat.post_count}</span>
                                            <span>댓글 {stat.comment_count}</span>
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-muted-foreground py-8 text-center">
                                활동 내역이 없습니다.
                            </p>
                        {/if}
                    </CardContent>
                </Card>
            {/if}
        {/if}
    {:catch}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">데이터를 불러오는데 실패했습니다.</p>
            </CardContent>
        </Card>
    {/await}
</div>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        line-clamp: 1;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .line-clamp-2 {
        display: -webkit-box;
        line-clamp: 2;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
