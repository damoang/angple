<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import PostForm from '$lib/components/features/board/post-form.svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { PageData } from './$types.js';
    import type { UpdatePostRequest } from '$lib/api/types.js';

    let { data }: { data: PageData } = $props();

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || boardId);

    let isSubmitting = $state(false);
    let error = $state<string | null>(null);

    // 권한 체크 (작성자 본인만 수정 가능)
    const isAuthor = $derived(
        authStore.user?.mb_id === data.post.author_id ||
            authStore.user?.mb_name === data.post.author
    );

    // 로그인 및 권한 체크
    $effect(() => {
        if (browser && !authStore.isLoading) {
            if (!authStore.isAuthenticated) {
                authStore.redirectToLogin();
            } else if (!isAuthor) {
                goto(`/${boardId}/${data.post.id}`);
            }
        }
    });

    // 글 수정 핸들러
    async function handleSubmit(formData: UpdatePostRequest): Promise<void> {
        if (!authStore.user || !isAuthor) {
            error = '수정 권한이 없습니다.';
            return;
        }

        isSubmitting = true;
        error = null;

        try {
            await apiClient.updatePost(boardId, String(data.post.id), formData);
            goto(`/${boardId}/${data.post.id}`);
        } catch (err) {
            console.error('Failed to update post:', err);
            error = err instanceof Error ? err.message : '게시글 수정에 실패했습니다.';
        } finally {
            isSubmitting = false;
        }
    }

    // 취소 핸들러
    function handleCancel(): void {
        goto(`/${boardId}/${data.post.id}`);
    }
</script>

<svelte:head>
    <title>글 수정 - {data.post.title} | {boardTitle} | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
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
    {:else if !isAuthor}
        <div class="py-12 text-center">
            <p class="text-destructive">수정 권한이 없습니다.</p>
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
        />
    {/if}
</div>
