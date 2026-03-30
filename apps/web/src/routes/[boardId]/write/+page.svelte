<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import PostForm from '$lib/components/features/board/post-form.svelte';
    import { writeFormRegistry } from '$lib/components/features/board/write-form-registry.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { PageData } from './$types.js';
    import type { CreatePostRequest, UpdatePostRequest } from '$lib/api/types.js';
    import type { WritePermission } from './+page.js';
    import { sendMentionNotifications } from '$lib/utils/mention-notify.js';
    import { checkPermission, getPermissionMessage } from '$lib/utils/board-permissions.js';
    import { trackEvent } from '$lib/services/ga4.js';

    let { data }: { data: PageData } = $props();

    // 소명 연동: disciplinelog_id 쿼리파라미터 처리
    const disciplinelogId = $derived($page.url.searchParams.get('disciplinelog_id') ?? '');
    const claimInitialTitle = $derived(
        disciplinelogId ? `이용제한 ${disciplinelogId}번에 대한 소명` : ''
    );
    const claimInitialLink1 = $derived(disciplinelogId ? `disciplinelog/${disciplinelogId}` : '');
    const claimInitialContent = $derived(
        disciplinelogId
            ? `<p>관련 이용제한 기록: <a href="/disciplinelog/${disciplinelogId}">이용제한 기록 #${disciplinelogId}</a></p><p></p>`
            : ''
    );

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || data.board?.name || boardId);
    const boardType = $derived(data.board?.board_type || 'standard');

    // 커스텀 글쓰기 폼 resolve (없으면 기본 PostForm 사용)
    const customWriteForm = $derived(writeFormRegistry.resolve(boardType));

    let isSubmitting = $state(false);
    let error = $state<string | null>(null);

    // claim 게시판 직접 접근 차단: disciplinelog_id 없이는 소명 작성 불가
    const isClaimWithoutDiscipline = $derived(boardId === 'claim' && !disciplinelogId);

    // 글쓰기 권한 조회 결과
    const writePermission = $derived(data.writePermission as WritePermission | null);

    // 글쓰기 제한으로 차단된 경우
    const isRestricted = $derived(writePermission !== null && !writePermission.can_write);
    const restrictionReason = $derived(writePermission?.reason ?? '');

    // 남은 횟수 표시 여부 (제한이 있고, remaining >= 0일 때)
    const showRemainingBadge = $derived(
        writePermission !== null &&
            writePermission.can_write &&
            writePermission.remaining >= 0 &&
            (writePermission.daily_limit > 0 || writePermission.total_limit > 0)
    );

    // 글쓰기 권한 체크
    const requiredLevel = $derived(data.board?.write_level ?? 3);
    const canWrite = $derived.by(() => {
        if (!authStore.isAuthenticated) return false;
        if (isRestricted) return false;
        return checkPermission(data.board, 'can_write', authStore.user ?? null);
    });
    const writePermissionMsg = $derived(
        isRestricted
            ? restrictionReason
            : getPermissionMessage(data.board, 'can_write', authStore.user ?? null)
    );

    // 로그인 체크 (클라이언트 사이드)
    $effect(() => {
        if (browser && !authStore.isLoading && !authStore.isAuthenticated) {
            authStore.redirectToLogin();
        }
    });

    // 글 작성 핸들러
    async function handleSubmit(formData: CreatePostRequest | UpdatePostRequest): Promise<void> {
        if (isSubmitting) return;
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
                postTitle: request.title || '',
                boardId,
                postId: newPost.id,
                senderName: authStore.user.mb_name,
                senderId: authStore.user.mb_id || ''
            });

            trackEvent('post_write', { board_id: boardId, post_id: newPost.id });

            // 직접홍보 게시판: 캐시 무효화 (글 작성 후 즉시 반영)
            if (boardId === 'promotion') {
                fetch('/api/boards/promotion/invalidate-cache', { method: 'POST' }).catch(() => {});
            }

            // 상세 페이지로 이동 (새 경로이므로 page load 자동 실행)
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
    {:else if isClaimWithoutDiscipline}
        <div class="py-12 text-center">
            <div class="bg-muted/50 mx-auto max-w-md rounded-lg p-8">
                <p class="text-muted-foreground text-lg font-medium">
                    소명 게시판은 직접 글을 작성할 수 없습니다
                </p>
                <p class="text-muted-foreground mt-2 text-sm">
                    이용제한 기록 상세 페이지에서 소명하기 버튼을 눌러 작성해주세요.
                </p>
                <a
                    href="/disciplinelog"
                    class="text-primary mt-4 inline-block text-sm hover:underline"
                    >이용제한 기록 목록 보기</a
                >
            </div>
        </div>
    {:else if !canWrite}
        <div class="py-12 text-center">
            <div class="bg-muted/50 mx-auto max-w-md rounded-lg p-8">
                <p class="text-muted-foreground text-lg font-medium">글쓰기 권한이 없습니다</p>
                <p class="text-muted-foreground mt-2 text-sm">{writePermissionMsg}</p>
            </div>
        </div>
    {:else}
        {#if error}
            <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-4">
                {error}
            </div>
        {/if}

        <h1 class="text-foreground mb-4 text-xl font-bold">{boardTitle} — 새 글 작성</h1>

        {#if showRemainingBadge}
            <div
                class="mb-4 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
            >
                {#if writePermission && writePermission.total_limit > 0}
                    총 <strong>{writePermission.remaining}</strong>/{writePermission.total_limit}회
                    작성 가능
                {:else}
                    오늘 <strong>{writePermission?.remaining}</strong
                    >/{writePermission?.daily_limit}회 작성 가능
                {/if}
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
                board={data.board ?? undefined}
                categories={data.categories}
                initialTitle={claimInitialTitle}
                initialLink1={claimInitialLink1}
                initialContent={claimInitialContent}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isLoading={isSubmitting}
            />
        {/if}
    {/if}
</div>
