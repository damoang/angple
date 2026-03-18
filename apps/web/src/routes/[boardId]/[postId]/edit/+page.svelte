<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import PostForm from '$lib/components/features/board/post-form.svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { PageData } from './$types.js';
    import type { UpdatePostRequest } from '$lib/api/types.js';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import { Button } from '$lib/components/ui/button/index.js';
    import { trackEvent } from '$lib/services/ga4.js';

    let { data }: { data: PageData } = $props();

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const postId = $derived(data.postId);
    const boardTitle = $derived(data.board?.subject || data.board?.name || boardId);
    const scheduledDelete = $derived(data.scheduledDelete);

    let isSubmitting = $state(false);
    let error = $state<string | null>(null);

    // 로그인 체크 (클라이언트 사이드)
    $effect(() => {
        if (browser && !authStore.isLoading && !authStore.isAuthenticated) {
            authStore.redirectToLogin();
        }
    });

    // 글 수정 핸들러
    async function handleSubmit(formData: UpdatePostRequest): Promise<void> {
        if (!authStore.user) {
            error = '로그인이 필요합니다.';
            return;
        }

        isSubmitting = true;
        error = null;

        try {
            await apiClient.updatePost(boardId, String(postId), formData);
            trackEvent('post_edit', { board_id: boardId, post_id: String(postId) });

            // 상세 페이지로 이동 (page load 재실행됨)
            goto(`/${boardId}/${postId}`, { invalidateAll: true });
        } catch (err) {
            console.error('Failed to update post:', err);
            error = err instanceof Error ? err.message : '게시글 수정에 실패했습니다.';
        } finally {
            isSubmitting = false;
        }
    }

    // 취소 핸들러
    function handleCancel(): void {
        goto(`/${boardId}/${postId}`);
    }
</script>

<svelte:head>
    <title>글수정 - {boardTitle} | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    {#if authStore.isLoading}
        <div class="py-12 text-center">
            <p class="text-muted-foreground">로딩 중...</p>
        </div>
    {:else if !authStore.isAuthenticated}
        <div class="py-12 text-center">
            <p class="text-muted-foreground">로그인이 필요합니다. 로그인 페이지로 이동합니다...</p>
        </div>
    {:else if scheduledDelete}
        <div
            class="bg-warning/10 border-warning/30 flex flex-col items-center gap-4 rounded-lg border p-8 text-center"
        >
            <AlertTriangle class="text-warning h-12 w-12" />
            <h2 class="text-lg font-semibold">이 게시물은 삭제가 예약되어 있습니다</h2>
            <p class="text-muted-foreground">
                삭제 예정: {new Date(scheduledDelete.scheduled_at).toLocaleString('ko-KR')}
                ({scheduledDelete.delay_minutes}분 지연)
            </p>
            <p class="text-muted-foreground text-sm">
                삭제 예약된 게시글은 수정할 수 없습니다. 수정하려면 먼저 삭제 예약을 취소해주세요.
            </p>
            <Button variant="outline" onclick={handleCancel}>게시글로 돌아가기</Button>
        </div>
    {:else}
        {#if error}
            <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-4">
                {error}
            </div>
        {/if}

        <PostForm
            mode="edit"
            post={data.post}
            categories={data.categories}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSubmitting}
            {boardId}
            board={data.board}
            attachments={data.files}
        />
    {/if}
</div>
