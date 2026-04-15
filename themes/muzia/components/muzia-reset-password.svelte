<script lang="ts">
    import { page } from '$app/stores';

    let password = $state('');
    let confirmPassword = $state('');
    let loading = $state(false);
    let error = $state('');
    let success = $state(false);

    const token = $derived($page.url.searchParams.get('token') || '');

    async function handleSubmit() {
        if (!password.trim() || password.length < 6) { error = '비밀번호는 6자 이상이어야 합니다'; return; }
        if (password !== confirmPassword) { error = '비밀번호가 일치하지 않습니다'; return; }
        loading = true; error = '';
        try {
            const r = await fetch('/api/muzia/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password })
            });
            const d = await r.json();
            if (d.success) { success = true; }
            else { error = d.error || '변경 실패'; }
        } catch { error = '요청 중 오류가 발생했습니다'; }
        finally { loading = false; }
    }
</script>

<div class="container mx-auto max-w-md px-4 py-12">
    <div class="rounded-lg border bg-card p-8 shadow-sm">
        {#if !token}
            <div class="text-center">
                <div class="mb-4 text-4xl">⚠️</div>
                <h1 class="mb-2 text-xl font-bold">유효하지 않은 링크</h1>
                <p class="text-sm text-muted-foreground">비밀번호 재설정 링크가 올바르지 않습니다.</p>
                <a href="/forgot-password" class="mt-4 block text-sm text-indigo-600 hover:underline">다시 요청하기</a>
            </div>
        {:else if success}
            <div class="text-center">
                <div class="mb-4 text-4xl">✅</div>
                <h1 class="mb-2 text-xl font-bold">비밀번호 변경 완료</h1>
                <p class="text-sm text-muted-foreground">새 비밀번호로 로그인해주세요.</p>
                <a href="/login" class="mt-4 block rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500">로그인하기</a>
            </div>
        {:else}
            <h1 class="mb-2 text-2xl font-bold">새 비밀번호 설정</h1>
            <p class="mb-6 text-sm text-muted-foreground">새로 사용할 비밀번호를 입력해주세요.</p>
            {#if error}
                <div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
            {/if}
            <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div class="mb-4">
                    <label class="mb-1 block text-sm font-medium">새 비밀번호</label>
                    <input type="password" bind:value={password} placeholder="6자 이상"
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div class="mb-6">
                    <label class="mb-1 block text-sm font-medium">비밀번호 확인</label>
                    <input type="password" bind:value={confirmPassword} placeholder="다시 입력"
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <button type="submit" disabled={loading}
                    class="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {loading ? '변경 중...' : '비밀번호 변경'}
                </button>
            </form>
        {/if}
    </div>
</div>
