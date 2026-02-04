<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import type { PageData } from './$types.js';
    import { Markdown } from '$lib/components/ui/markdown/index.js';
    import Heart from '@lucide/svelte/icons/heart';
    import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
    import Users from '@lucide/svelte/icons/users';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import Pin from '@lucide/svelte/icons/pin';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import DeleteConfirmDialog from '$lib/components/features/board/delete-confirm-dialog.svelte';
    import CommentForm from '$lib/components/features/board/comment-form.svelte';
    import CommentList from '$lib/components/features/board/comment-list.svelte';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import type { FreeComment, LikerInfo } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import { AdultBlur } from '$lib/components/features/adult/index.js';

    let { data }: { data: PageData } = $props();

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || boardId);

    // 댓글 목록 상태 (반응형으로 관리)
    let comments = $state<FreeComment[]>(data.comments.items);
    let isCreatingComment = $state(false);

    // 추천/비추천 상태
    let likeCount = $state(data.post.likes);
    let dislikeCount = $state(0);
    let isLiked = $state(false);
    let isDisliked = $state(false);
    let isLiking = $state(false);
    let isDisliking = $state(false);

    // 추천자 목록 다이얼로그 상태
    let showLikersDialog = $state(false);
    let likers = $state<LikerInfo[]>([]);
    let likersTotal = $state(0);
    let isLoadingLikers = $state(false);

    // 게시글 삭제 상태
    let isDeleting = $state(false);

    // 신고 다이얼로그 상태
    let showReportDialog = $state(false);

    // 초기 추천 상태 로드
    onMount(async () => {
        if (authStore.isAuthenticated) {
            try {
                const status = await apiClient.getPostLikeStatus(boardId, String(data.post.id));
                isLiked = status.user_liked;
                isDisliked = status.user_disliked ?? false;
                likeCount = status.likes;
                dislikeCount = status.dislikes ?? 0;
            } catch (err) {
                console.error('Failed to load like status:', err);
            }
        }
    });

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
        goto(`/${boardId}`);
    }

    // 수정 페이지로 이동
    function goToEdit(): void {
        goto(`/${boardId}/${data.post.id}/edit`);
    }

    // 작성자 확인
    const isAuthor = $derived(
        authStore.user?.mb_id === data.post.author_id ||
            authStore.user?.mb_name === data.post.author
    );

    // 관리자 여부 (레벨 10 이상)
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);

    // 공지 상태
    let noticeType = $state<'normal' | 'important' | null>(data.post.notice_type ?? null);
    let isTogglingNotice = $state(false);

    async function toggleNotice(type: 'normal' | 'important' | null): Promise<void> {
        isTogglingNotice = true;
        try {
            await apiClient.toggleNotice(boardId, data.post.id, type);
            noticeType = type;
        } catch (err) {
            console.error('Failed to toggle notice:', err);
            alert('공지 설정에 실패했습니다.');
        } finally {
            isTogglingNotice = false;
        }
    }

    // 게시글 삭제
    async function handleDelete(): Promise<void> {
        isDeleting = true;
        try {
            await apiClient.deletePost(boardId, String(data.post.id));
            goto(`/${boardId}`);
        } catch (err) {
            console.error('Failed to delete post:', err);
            alert('게시글 삭제에 실패했습니다.');
        } finally {
            isDeleting = false;
        }
    }

    // 게시글 추천
    async function handleLike(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        if (isLiking) return;

        isLiking = true;
        try {
            const response = await apiClient.likePost(boardId, String(data.post.id));
            isLiked = response.user_liked;
            isDisliked = response.user_disliked ?? false;
            likeCount = response.likes;
            dislikeCount = response.dislikes ?? 0;
        } catch (err) {
            console.error('Failed to like post:', err);
            alert('추천에 실패했습니다.');
        } finally {
            isLiking = false;
        }
    }

    // 게시글 비추천
    async function handleDislike(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        if (isDisliking) return;

        isDisliking = true;
        try {
            const response = await apiClient.dislikePost(boardId, String(data.post.id));
            isLiked = response.user_liked;
            isDisliked = response.user_disliked ?? false;
            likeCount = response.likes;
            dislikeCount = response.dislikes ?? 0;
        } catch (err) {
            console.error('Failed to dislike post:', err);
            alert('비추천에 실패했습니다.');
        } finally {
            isDisliking = false;
        }
    }

    // 추천자 목록 로드
    async function loadLikers(): Promise<void> {
        showLikersDialog = true;
        isLoadingLikers = true;
        try {
            const response = await apiClient.getPostLikers(boardId, String(data.post.id));
            likers = response.likers;
            likersTotal = response.total;
        } catch (err) {
            console.error('Failed to load likers:', err);
        } finally {
            isLoadingLikers = false;
        }
    }

    // 댓글 작성
    async function handleCreateComment(
        content: string,
        parentId?: string | number,
        isSecret?: boolean
    ): Promise<void> {
        if (!authStore.user) {
            throw new Error('로그인이 필요합니다.');
        }

        isCreatingComment = true;
        try {
            const newComment = await apiClient.createComment(boardId, String(data.post.id), {
                content,
                author: authStore.user.mb_name,
                parent_id: parentId,
                is_secret: isSecret
            });

            // 댓글 목록에 추가
            comments = [...comments, newComment];
        } finally {
            isCreatingComment = false;
        }
    }

    // 답글 작성
    async function handleReplyComment(
        content: string,
        parentId: string | number,
        isSecret?: boolean
    ): Promise<void> {
        if (!authStore.user) {
            throw new Error('로그인이 필요합니다.');
        }

        const newComment = await apiClient.createComment(boardId, String(data.post.id), {
            content,
            author: authStore.user.mb_name,
            parent_id: parentId,
            is_secret: isSecret
        });

        // 댓글 목록에 추가
        comments = [...comments, newComment];
    }

    // 댓글 수정
    async function handleUpdateComment(commentId: string, content: string): Promise<void> {
        await apiClient.updateComment(boardId, String(data.post.id), commentId, { content });

        // 로컬 상태 업데이트
        comments = comments.map((c) =>
            String(c.id) === commentId ? { ...c, content, updated_at: new Date().toISOString() } : c
        );
    }

    // 댓글 삭제
    async function handleDeleteComment(commentId: string): Promise<void> {
        await apiClient.deleteComment(boardId, String(data.post.id), commentId);

        // 로컬 상태에서 제거
        comments = comments.filter((c) => String(c.id) !== commentId);
    }

    // 댓글 추천
    async function handleLikeComment(
        commentId: string
    ): Promise<{ likes: number; user_liked: boolean }> {
        const response = await apiClient.likeComment(boardId, String(data.post.id), commentId);
        return {
            likes: response.likes,
            user_liked: response.user_liked
        };
    }

    // 댓글 비추천
    async function handleDislikeComment(
        commentId: string
    ): Promise<{ dislikes: number; user_disliked: boolean }> {
        const response = await apiClient.dislikeComment(boardId, String(data.post.id), commentId);
        return {
            dislikes: response.dislikes ?? 0,
            user_disliked: response.user_disliked ?? false
        };
    }
</script>

<svelte:head>
    <title>{data.post.title} - {boardTitle} | 다모앙</title>
    <meta name="description" content={data.post.content.slice(0, 150)} />
</svelte:head>

<div class="mx-auto pt-2">
    <!-- 상단 네비게이션 -->
    <div class="mb-6 flex items-center justify-between">
        <Button variant="outline" size="sm" onclick={goBack}>← 목록으로</Button>

        <div class="flex gap-2">
            {#if isAdmin}
                {#if noticeType}
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() => toggleNotice(null)}
                        disabled={isTogglingNotice}
                    >
                        <Pin class="mr-1 h-4 w-4" />
                        공지 해제
                    </Button>
                {:else}
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() => toggleNotice('important')}
                        disabled={isTogglingNotice}
                    >
                        <Pin class="mr-1 h-4 w-4" />
                        공지 고정
                    </Button>
                {/if}
            {/if}
            {#if isAuthor}
                <Button variant="outline" size="sm" onclick={goToEdit}>
                    <Pencil class="mr-1 h-4 w-4" />
                    수정
                </Button>
                <DeleteConfirmDialog
                    title="게시글 삭제"
                    description="이 게시글을 삭제하시겠습니까? 댓글도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다."
                    onConfirm={handleDelete}
                    isLoading={isDeleting}
                />
            {/if}
        </div>
    </div>

    <!-- 게시글 헤더 -->
    <Card class="bg-background mb-6">
        <CardHeader class="space-y-3">
            <div>
                {#if data.post.category}
                    <div class="mb-3 flex flex-wrap gap-1.5">
                        <span
                            class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-xs font-medium"
                        >
                            {data.post.category}
                        </span>
                    </div>
                {/if}
                <CardTitle class="text-foreground flex items-center gap-2 text-3xl">
                    {#if data.post.is_secret}
                        <Lock class="text-muted-foreground h-6 w-6 shrink-0" />
                    {/if}
                    {data.post.title}
                </CardTitle>
                {#if data.post.tags && data.post.tags.length > 0}
                    <div class="mt-3 flex flex-wrap gap-2">
                        {#each data.post.tags as tag, i (i)}
                            <Badge variant="secondary">{tag}</Badge>
                        {/each}
                    </div>
                {/if}
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
                    <span>👍 {likeCount.toLocaleString()}</span>
                    <span>💬 {data.post.comments_count.toLocaleString()}</span>
                </div>
            </div>

            <!-- 게시글 본문 -->
            <AdultBlur isAdult={data.post.is_adult ?? false}>
                <Markdown content={data.post.content} class="mt-8" />

                {#if data.post.images && data.post.images.length > 0}
                    <div class="mt-6 grid gap-4">
                        {#each data.post.images as image, i (i)}
                            <img
                                src={image}
                                alt="게시글 이미지"
                                class="rounded-lg border"
                                loading="lazy"
                            />
                        {/each}
                    </div>
                {/if}
            </AdultBlur>

            <!-- 추천/비추천 버튼 -->
            <div class="mb-3 mt-8 flex items-center gap-3">
                <!-- 추천 버튼 -->
                <div class="border-border flex items-center rounded-lg border">
                    <Button
                        variant="ghost"
                        size="sm"
                        onclick={handleLike}
                        disabled={isLiking}
                        class="gap-2 {isLiked ? 'text-red-500' : ''}"
                    >
                        <Heart class="h-5 w-5 {isLiked ? 'fill-red-500' : ''}" />
                        <span class="font-semibold">{likeCount}</span>
                    </Button>
                    <button
                        type="button"
                        onclick={loadLikers}
                        class="text-muted-foreground hover:text-foreground border-border border-l px-2 py-1 text-xs transition-colors"
                    >
                        <Users class="h-4 w-4" />
                    </button>
                </div>

                <!-- 비추천 버튼 (게시판 설정에서 활성화된 경우만) -->
                {#if data.board?.use_nogood === 1}
                    <div class="border-border flex items-center rounded-lg border">
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={handleDislike}
                            disabled={isDisliking}
                            class="gap-2 {isDisliked ? 'text-blue-500' : ''}"
                        >
                            <ThumbsDown class="h-5 w-5 {isDisliked ? 'fill-blue-500' : ''}" />
                            <span class="font-semibold">{dislikeCount}</span>
                        </Button>
                    </div>
                {/if}

                <!-- 신고 버튼 -->
                {#if !isAuthor}
                    <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => {
                            if (!authStore.isAuthenticated) {
                                authStore.redirectToLogin();
                                return;
                            }
                            showReportDialog = true;
                        }}
                        class="text-muted-foreground hover:text-destructive ml-auto gap-2"
                    >
                        <Flag class="h-4 w-4" />
                        <span>신고</span>
                    </Button>
                {/if}
            </div>
        </CardHeader>
    </Card>

    <!-- 수정/삭제 시간 표시 -->
    {#if data.post.updated_at && data.post.updated_at !== data.post.created_at}
        <p class="text-muted-foreground mt-4 text-center text-sm">
            마지막 수정: {formatDate(data.post.updated_at)}
        </p>
    {/if}

    <!-- 댓글 섹션 -->
    <Card class="bg-background">
        <CardHeader class="space-y-6">
            <div class="flex items-center justify-between">
                <h3 class="text-foreground text-lg font-semibold">
                    댓글 <span class="text-muted-foreground">({comments.length})</span>
                </h3>
            </div>

            <!-- 댓글 목록 -->
            <CommentList
                {comments}
                onUpdate={handleUpdateComment}
                onDelete={handleDeleteComment}
                onReply={handleReplyComment}
                onLike={handleLikeComment}
                onDislike={handleDislikeComment}
                postAuthorId={data.post.author_id}
                {boardId}
                postId={data.post.id}
                useNogood={data.board?.use_nogood === 1}
            />

            <!-- 댓글 작성 폼 -->
            <div class="border-border border-t pt-6">
                <CommentForm
                    onSubmit={handleCreateComment}
                    isLoading={isCreatingComment}
                    permissions={data.board?.permissions}
                    requiredCommentLevel={data.board?.comment_level ?? 1}
                />
            </div>
        </CardHeader>
    </Card>
</div>

<!-- 추천자 목록 다이얼로그 -->
<Dialog.Root bind:open={showLikersDialog}>
    <Dialog.Content class="max-w-sm">
        <Dialog.Header>
            <Dialog.Title>추천한 사람들</Dialog.Title>
            <Dialog.Description>
                이 게시글을 추천한 {likersTotal}명
            </Dialog.Description>
        </Dialog.Header>
        <div class="max-h-64 overflow-y-auto">
            {#if isLoadingLikers}
                <div class="text-muted-foreground py-8 text-center">불러오는 중...</div>
            {:else if likers.length === 0}
                <div class="text-muted-foreground py-8 text-center">
                    아직 추천한 사람이 없습니다.
                </div>
            {:else}
                <ul class="divide-border divide-y">
                    {#each likers as liker (liker.mb_id)}
                        <li class="flex items-center gap-3 py-3">
                            <div
                                class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm"
                            >
                                {liker.mb_name.charAt(0).toUpperCase()}
                            </div>
                            <div class="flex-1">
                                <p class="text-foreground text-sm font-medium">{liker.mb_name}</p>
                                <p class="text-muted-foreground text-xs">
                                    {formatDate(liker.liked_at)}
                                </p>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>

<!-- 게시글 신고 다이얼로그 -->
<ReportDialog
    bind:open={showReportDialog}
    targetType="post"
    targetId={data.post.id}
    {boardId}
    postId={data.post.id}
    onClose={() => (showReportDialog = false)}
/>
