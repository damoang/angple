<script lang="ts">
    import { goto } from '$app/navigation';
    import { toast } from 'svelte-sonner';
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

    /**
     * datetime-local 입력용 'YYYY-MM-DDTHH:mm' (로컬 시각 기준).
     * toISOString() 은 UTC 로 바꿔버려 9시간이 어긋나므로 쓰지 않는다.
     */
    function toLocalInput(d: Date): string {
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    let method = $state<GivingMethod>('lowest_unique');
    let capacity = $state(1);
    let numberMax = $state(100);
    let unitPrice = $state(100);
    // ⛔ 일정을 빈 값으로 두지 않는다.
    // 백엔드 Normalize 는 시작·마감이 모두 있어야 active 로 판정하고, 하나라도 비면
    // no_giving 이 된다. 프론트는 status==='active' 일 때만 참가 UI를 그리므로
    // **참가 버튼이 아예 안 뜨는 글**이 아무 경고 없이 게시된다.
    // 2026-07-23 첫 나눔(#2397)이 정확히 이 상태로 올라갔다 — 주최자도 회원도 몰랐다.
    let startAt = $state(toLocalInput(now));
    let endAt = $state(toLocalInput(weekLater));

    let busy = $state(false);
    let error = $state<string | null>(null);

    async function handleSubmit(formData: CreatePostRequest | UpdatePostRequest): Promise<void> {
        if (busy) return;
        if (!authStore.user) {
            error = '로그인이 필요합니다.';
            return;
        }
        // 일정이 비면 참가 버튼이 안 뜨는 글이 된다(no_giving) — 등록 자체를 막는다.
        if (!startAt || !endAt) {
            error = '나눔 시작일시와 마감일시를 모두 입력해주세요.';
            return;
        }
        if (new Date(endAt) <= new Date(startAt)) {
            error = '마감일시는 시작일시보다 뒤여야 합니다.';
            return;
        }

        busy = true;
        error = null;
        try {
            const req: CreatePostRequest = {
                ...(formData as CreatePostRequest),
                author: authStore.user.mb_name,
                extra_2: method === 'lowest_unique' ? String(unitPrice) : '0',
                extra_4: startAt,
                extra_5: endAt
            };
            const post = await apiClient.createPost(boardId, req);
            if (!post?.id) throw new Error('게시글 작성에 실패했습니다.');

            // 방식 설정 저장.
            //
            // ⛔ 실패를 조용히 삼키지 않는다. 설정이 없으면 백엔드가 '준비 중'으로 두어
            // 아무도 참가할 수 없는데, 주최자가 그 사실을 모르면 글만 덩그러니 남는다.
            // 글은 이미 생성됐으므로 폼에 머물지 않고(재제출 시 중복 등록) 상세로 보내되,
            // 무엇을 해야 하는지 분명히 알린다.
            try {
                await givingApi.config(post.id, { method, capacity, number_max: numberMax });
            } catch (configErr) {
                console.error('나눔 설정 저장 실패:', configErr);
                toast.error(
                    '나눔 방식이 저장되지 않았어요. 글에서 설정을 완료해야 참가를 받을 수 있어요.',
                    {
                        duration: 10000
                    }
                );
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
