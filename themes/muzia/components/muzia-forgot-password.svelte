<script lang="ts">
    let email = $state('');
    let loading = $state(false);
    let sent = $state(false);
    let error = $state('');

    async function handleSubmit() {
        if (!email.trim()) { error = '이메일을 입력해주세요'; return; }
        loading = true; error = '';
        try {
            const r = await fetch('/api/muzia/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() })
            });
            const d = await r.json();
            sent = true;
        } catch { error = '요청 중 오류가 발생했습니다'; }
        finally { loading = false; }
    }
</script>

<div class="container mx-auto max-w-md px-4 py-12">
    <div class="rounded-lg border bg-card p-8 shadow-sm">
        {#if sent}
            <div class="text-center">
                <div class="mb-4 text-4xl">📧</div>
                <h1 class="mb-2 text-xl font-bold">이메일을 확인해주세요</h1>
                <p class="text-sm text-muted-foreground">
                    등록된 이메일이라면 비밀번호 재설정 링크가 발송되었습니다.<br>
                    30분 이내에 링크를 클릭해주세요.
                </p>
                <p class="mt-4 text-xs text-muted-foreground">이메일이 오지 않으면 스팸함을 확인하거나<br/><a href="mailto:help@muzia.net" class="text-indigo-600 hover:underline">help@muzia.net</a>으로 문의해주세요.</p>
                <a href="/login" class="mt-6 block text-sm text-muted-foreground hover:text-foreground">← 로그인으로 돌아가기</a>
            </div>
        {:else}
            <h1 class="mb-2 text-2xl font-bold">비밀번호 찾기</h1>
            <p class="mb-6 text-sm text-muted-foreground">가입 시 등록한 이메일을 입력하면 재설정 링크를 보내드립니다.</p>
            {#if error}
                <div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
            {/if}
            <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div class="mb-6">
                    <label class="mb-1 block text-sm font-medium">이메일</label>
                    <input type="email" bind:value={email} placeholder="가입 시 등록한 이메일"
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <button type="submit" disabled={loading}
                    class="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {loading ? '발송 중...' : '재설정 링크 발송'}
                </button>
            </form>
            <a href="/login" class="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">← 로그인으로 돌아가기</a>
        {/if}
    </div>
</div>
