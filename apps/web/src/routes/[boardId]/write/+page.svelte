<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import PostForm from '$lib/components/features/board/post-form.svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { PageData } from './$types.js';
    import type { CreatePostRequest, UpdatePostRequest } from '$lib/api/types.js';

    let { data }: { data: PageData } = $props();

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || boardId);

    let isSubmitting = $state(false);
    let error = $state<string | null>(null);

    // 로그인 체크 (클라이언트 사이드)
    $effect(() => {
        if (browser && !authStore.isLoading && !authStore.isAuthenticated) {
            authStore.redirectToLogin();
        }
    });

    // 글 작성 핸들러
    async function handleSubmit(formData: CreatePostRequest | UpdatePostRequest): Promise<void> {
        if (!authStore.user) {
            error = '로그인이 필요합니다.';
            return;
        }

        isSubmitting = true;
        error = null;

        try {
            const createData = formData as CreatePostRequest;

            const request: CreatePostRequest = {
                ...createData,
                author: authStore.user.mb_name
            };

            const newPost = await apiClient.createPost(boardId, request);

            goto(`/${boardId}/${newPost.id}`);
        } catch (err) {
            console.error('Failed to create post:', err);
            error = err instanceof Error ? err.message : '게시글 작성에 실패했습니다.';
        } finally {
            isSubmitting = false;
        }
    }

    // 취소 핸들러
    function handleCancel(): void {
        goto(`/${boardId}`);
    }
</script>

<svelte:head>
    <title>글쓰기 - {boardTitle} | 다모앙</title>
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
    {:else}
        {#if error}
            <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-4">
                {error}
            </div>
        {/if}

        <PostForm
            mode="create"
            categories={data.categories}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSubmitting}
        />
    {/if}
</div>
