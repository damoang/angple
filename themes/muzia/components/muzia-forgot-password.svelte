<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';

    let email = $state('');
    let name = $state('');
    let loading = $state(false);
    let error = $state('');
    let result = $state<{ mb_id: string; temp_password: string } | null>(null);

    async function handleSubmit() {
        if (!email.trim() || !name.trim()) { error = '이메일과 이름을 입력해주세요'; return; }
        loading = true; error = '';
        try {
            const r = await fetch('/api/muzia/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), name: name.trim() })
            });
            const d = await r.json();
            if (d.success) {
                result = d.data;
            } else {
                error = typeof d.error === 'object' ? d.error.message : d.error;
            }
        } catch { error = '요청 중 오류가 발생했습니다'; }
        finally { loading = false; }
    }
</script>

<div class="container mx-auto max-w-md px-4 py-12">
    <div class="rounded-lg border bg-card p-8 shadow-sm">
        <h1 class="mb-2 text-2xl font-bold">비밀번호 찾기</h1>
        <p class="mb-6 text-sm text-muted-foreground">가입 시 등록한 이메일과 이름을 입력하면 임시 비밀번호를 발급합니다.</p>

        {#if result}
            <div class="rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950">
                <div class="mb-3 text-center text-3xl">🔑</div>
                <h2 class="mb-2 text-center text-lg font-bold text-green-800 dark:text-green-200">임시 비밀번호 발급 완료</h2>
                <div class="mb-4 rounded-lg bg-white p-4 text-center dark:bg-zinc-900">
                    <p class="text-sm text-muted-foreground">아이디: <strong>{result.mb_id}</strong></p>
                    <p class="mt-2 text-2xl font-mono font-bold tracking-widest">{result.temp_password}</p>
                </div>
                <p class="text-center text-sm text-green-700 dark:text-green-300">이 비밀번호로 로그인 후 반드시 비밀번호를 변경해주세요.</p>
                <a href="/login" class="mt-4 block rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500">로그인하기</a>
            </div>
        {:else}
            {#if error}
                <div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
            {/if}
            <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div class="mb-4">
                    <label class="mb-1 block text-sm font-medium">이메일</label>
                    <input type="email" bind:value={email} placeholder="가입 시 등록한 이메일"
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div class="mb-6">
                    <label class="mb-1 block text-sm font-medium">이름 (닉네임)</label>
                    <input type="text" bind:value={name} placeholder="가입 시 등록한 이름 또는 닉네임"
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <button type="submit" disabled={loading}
                    class="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {loading ? '처리 중...' : '임시 비밀번호 발급'}
                </button>
            </form>
            <div class="mt-4 text-center">
                <a href="/login" class="text-sm text-muted-foreground hover:text-foreground">← 로그인으로 돌아가기</a>
            </div>
        {/if}
    </div>
</div>
