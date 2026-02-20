<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import PostForm from '$lib/components/features/board/post-form.svelte';
    import { writeFormRegistry } from '$lib/components/features/board/write-form-registry.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { PageData } from './$types.js';
    import type { CreatePostRequest, UpdatePostRequest } from '$lib/api/types.js';
    import { sendMentionNotifications } from '$lib/utils/mention-notify.js';

    let { data }: { data: PageData } = $props();

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || boardId);
    const boardType = $derived(data.board?.board_type || 'standard');

    // 커스텀 글쓰기 폼 resolve (없으면 기본 PostForm 사용)
    const customWriteForm = $derived(writeFormRegistry.resolve(boardType));

    let isSubmitting = $state(false);
    let error = $state<string | null>(null);

    // 글쓰기 권한 체크
    const requiredLevel = $derived(data.board?.write_level ?? 3);
    const canWrite = $derived(() => {
        if (!authStore.isAuthenticated) return false;
        if (data.board?.permissions) return data.board.permissions.can_write;
        return (authStore.user?.mb_level ?? 1) >= requiredLevel;
    });

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
            if (!newPost?.id) {
                throw new Error('게시글 작성에 실패했습니다. (응답 오류)');
            }

            // @멘션 알림 전송 (fire-and-forget)
            sendMentionNotifications({
                content: request.content || '',
                postUrl: `/${boardId}/${newPost.id}`,
                postTitle: request.title,
                boardId,
                postId: newPost.id,
                senderName: authStore.user.mb_name,
                senderId: authStore.user.mb_id || ''
            });

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
    <title>글쓰기 - {boardTitle} | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
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
    {:else if !canWrite()}
        <div class="py-12 text-center">
            <div class="bg-muted/50 mx-auto max-w-md rounded-lg p-8">
                <p class="text-muted-foreground text-lg font-medium">글쓰기 권한이 없습니다</p>
                <p class="text-muted-foreground mt-2 text-sm">
                    레벨 {requiredLevel} 이상부터 글쓰기가 가능합니다.
                </p>
                <p class="text-muted-foreground mt-1 text-sm">
                    현재 레벨: {authStore.user?.mb_level ?? 1}
                </p>
            </div>
        </div>
    {:else}
        {#if error}
            <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-4">
                {error}
            </div>
        {/if}

        {#if customWriteForm}
            {@const CustomWriteForm = customWriteForm}
            <CustomWriteForm
                {boardId}
                categories={data.categories}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={isSubmitting}
            />
        {:else}
            <PostForm
                mode="create"
                categories={data.categories}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={isSubmitting}
            />
        {/if}
    {/if}
</div>
