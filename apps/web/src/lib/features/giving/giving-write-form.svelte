<script lang="ts">
    import { goto } from '$app/navigation';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import PostForm from '$lib/components/features/board/post-form.svelte';
    import type { CreatePostRequest, UpdatePostRequest, Board } from '$lib/api/types.js';
    import MethodSelect from './method-select.svelte';
    import { type GivingMethod } from './methods.js';
    import { givingApi } from './api.js';

    let {
        boardId = 'giving',
        board,
        categories = [],
        contentFormat = 'html',
        onCancel
    }: {
        boardId?: string;
        board?: Board;
        categories?: string[];
        contentFormat?: 'html' | 'markdown';
        onSubmit?: (data: CreatePostRequest | UpdatePostRequest) => Promise<void>;
        onCancel: () => void;
        isLoading?: boolean;
    } = $props();

    let method = $state<GivingMethod>('lowest_unique');
    let capacity = $state(1);
    let numberMax = $state(100);
    let unitPrice = $state(100);
    let startAt = $state('');
    let endAt = $state('');

    let busy = $state(false);
    let error = $state<string | null>(null);

    async function handleSubmit(formData: CreatePostRequest | UpdatePostRequest): Promise<void> {
        if (busy) return;
        if (!authStore.user) {
            error = '로그인이 필요합니다.';
            return;
        }
        busy = true;
        error = null;
        try {
            const req: CreatePostRequest = {
                ...(formData as CreatePostRequest),
                author: authStore.user.mb_name,
                extra_2: method === 'lowest_unique' ? String(unitPrice) : '0',
                extra_4: startAt || '',
                extra_5: endAt || ''
            };
            const post = await apiClient.createPost(boardId, req);
            if (!post?.id) throw new Error('게시글 작성에 실패했습니다.');

            // 방식 설정 저장 (실패해도 글은 생성됨 — 상세 페이지에서 재설정 가능)
            try {
                await givingApi.config(post.id, { method, capacity, number_max: numberMax });
            } catch {
                /* 상세에서 주최자가 다시 설정할 수 있음 */
            }
            goto(`/${boardId}/${post.id}`);
        } catch (e) {
            error = e instanceof Error ? e.message : '게시글 작성에 실패했습니다.';
        } finally {
            busy = false;
        }
    }
</script>

<div class="space-y-4">
    {#if error}
        <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
    {/if}

    <div class="border-border rounded-lg border p-4">
        <h2 class="mb-3 text-sm font-semibold">나눔 설정</h2>
        <MethodSelect bind:method bind:capacity bind:numberMax bind:unitPrice />

        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
                <label for="giving-start" class="text-foreground mb-1 block text-sm font-medium"
                    >시작 일시</label
                >
                <input
                    id="giving-start"
                    type="datetime-local"
                    bind:value={startAt}
                    class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label for="giving-end" class="text-foreground mb-1 block text-sm font-medium"
                    >종료 일시</label
                >
                <input
                    id="giving-end"
                    type="datetime-local"
                    bind:value={endAt}
                    class="border-border bg-background text-foreground w-full rounded-md border px-3 py-2 text-sm"
                />
            </div>
        </div>
    </div>

    <PostForm
        mode="create"
        {board}
        {categories}
        {boardId}
        {contentFormat}
        onSubmit={handleSubmit}
        {onCancel}
        isLoading={busy}
    />
</div>
