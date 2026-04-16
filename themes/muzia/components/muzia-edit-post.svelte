<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';

    interface Props { boardId: string; postId: string; }
    const { boardId, postId }: Props = $props();

    let title = $state('');
    let content = $state('');
    let loading = $state(true);
    let saving = $state(false);
    let uploading = $state(false);
    let error = $state('');
    let success = $state(false);
    let fileInput: HTMLInputElement;
    let contentArea: HTMLTextAreaElement;

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

    async function uploadImage(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        uploading = true;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const r = await fetch('/api/muzia/upload', { method: 'POST', headers: authHeaders(), body: formData });
            const d = await r.json();
            if (d.success && d.data?.url) {
                // 커서 위치에 이미지 태그 삽입
                const imgTag = `[${d.data.url}]`;
                if (contentArea) {
                    const start = contentArea.selectionStart;
                    content = content.slice(0, start) + imgTag + content.slice(contentArea.selectionEnd);
                } else {
                    content += '\n' + imgTag;
                }
            } else {
                alert(typeof d.error === 'object' ? d.error.message : (d.error || '업로드 실패'));
            }
        } catch { alert('업로드 실패'); }
        finally { uploading = false; input.value = ''; }
    }

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
                    <textarea bind:value={content} bind:this={contentArea} rows="15"
                        class="w-full resize-y rounded-lg border bg-background px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-400"></textarea>
                    <div class="mt-2 flex items-center gap-2">
                        <button class="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent" onclick={() => fileInput?.click()}>
                            {uploading ? '⏳ 업로드 중...' : '📷 이미지 첨부'}
                        </button>
                        <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={uploadImage} />
                        <span class="text-xs text-muted-foreground">이미지를 첨부하면 [URL] 형태로 삽입됩니다</span>
                    </div>
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
