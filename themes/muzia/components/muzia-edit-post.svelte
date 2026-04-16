<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';
    import { page } from '$app/stores';

    interface Props { boardId: string; postId: string; }
    const { boardId, postId }: Props = $props();

    let title = $state('');
    let content = $state('');
    let loading = $state(true);
    let saving = $state(false);
    let error = $state('');
    let success = $state(false);

    function authHeaders(): Record<string, string> {
        if (!browser) return {};
        try { const t = localStorage.getItem('access_token'); return t ? { 'Authorization': `Bearer ${t}` } : {}; }
        catch { return {}; }
    }

    $effect(() => {
        fetch(`/api/muzia/edit?board=${boardId}&id=${postId}`, { headers: authHeaders() })
            .then(r => r.json())
            .then(d => {
                if (d.success) { title = d.data.title; content = d.data.content; }
                else { error = d.error || '불러오기 실패'; }
            })
            .catch(() => error = '불러오기 실패')
            .finally(() => loading = false);
    });

    async function handleSave() {
        if (!title.trim()) { error = '제목을 입력해주세요'; return; }
        saving = true; error = '';
        try {
            const r = await fetch('/api/muzia/edit', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ board_id: boardId, post_id: postId, title, content })
            });
            const d = await r.json();
            if (d.success) {
                success = true;
                setTimeout(() => { window.location.href = `/${boardId}/${postId}`; }, 1000);
            } else { error = d.error || '수정 실패'; }
        } catch { error = '수정 중 오류'; }
        finally { saving = false; }
    }
</script>

<div class="container mx-auto max-w-4xl px-4 py-6">
    <a href="/{boardId}/{postId}" class="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← 돌아가기</a>

    {#if loading}
        <div class="py-20 text-center text-muted-foreground">로딩 중...</div>
    {:else if success}
        <div class="py-20 text-center">
            <div class="mb-4 text-4xl">✅</div>
            <p class="text-lg font-medium">수정 완료! 이동 중...</p>
        </div>
    {:else}
        <div class="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div class="border-b p-6">
                <h1 class="text-xl font-bold">글 수정</h1>
            </div>
            <div class="p-6">
                {#if error}
                    <div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
                {/if}
                <div class="mb-4">
                    <label class="mb-1 block text-sm font-medium">제목</label>
                    <input type="text" bind:value={title}
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div class="mb-4">
                    <label class="mb-1 block text-sm font-medium">내용</label>
                    <textarea bind:value={content} rows="15"
                        class="w-full resize-y rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400"></textarea>
                </div>
                <div class="flex justify-end gap-2">
                    <a href="/{boardId}/{postId}">
                        <Button variant="outline">취소</Button>
                    </a>
                    <Button class="bg-indigo-600 text-white hover:bg-indigo-500" onclick={handleSave} disabled={saving}>
                        {saving ? '저장 중...' : '수정 완료'}
                    </Button>
                </div>
            </div>
        </div>
    {/if}
</div>
