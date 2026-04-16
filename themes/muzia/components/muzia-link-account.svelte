<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';

    let mbId = $state('');
    let password = $state('');
    let loading = $state(false);
    let error = $state('');
    let success = $state(false);
    let linkedId = $state('');

    function authHeaders(): Record<string, string> {
        if (!browser) return {};
        try { const t = localStorage.getItem('access_token'); return t ? { 'Authorization': `Bearer ${t}` } : {}; }
        catch { return {}; }
    }

    // 현재 로그인 사용자 확인
    function getCurrentUser() {
        if (!browser) return null;
        try {
            const token = localStorage.getItem('access_token');
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1]));
            return { mb_id: payload.username || payload.user_id, nickname: payload.nickname };
        } catch { return null; }
    }

    let currentUser = $state<{ mb_id: string; nickname: string } | null>(null);
    $effect(() => { currentUser = getCurrentUser(); });

    const isOAuth = $derived(currentUser?.mb_id?.startsWith('oauth_') || currentUser?.mb_id?.startsWith('naver_') || currentUser?.mb_id?.startsWith('google_') || currentUser?.mb_id?.startsWith('kakao_'));

    async function handleLink() {
        if (!mbId.trim() || !password.trim()) { error = '아이디와 비밀번호를 입력해주세요'; return; }
        loading = true; error = '';
        try {
            const r = await fetch('/api/muzia/link-account', {
                method: 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ mb_id: mbId.trim(), password: password.trim() })
            });
            const d = await r.json();
            if (d.success) {
                success = true;
                linkedId = d.data.mb_id;
            } else {
                error = typeof d.error === 'object' ? d.error.message : d.error;
            }
        } catch { error = '요청 중 오류가 발생했습니다'; }
        finally { loading = false; }
    }
</script>

<div class="container mx-auto max-w-md px-4 py-12">
    <div class="rounded-lg border bg-card p-8 shadow-sm">
        {#if !currentUser}
            <div class="text-center">
                <div class="mb-4 text-4xl">🔒</div>
                <h1 class="mb-2 text-xl font-bold">로그인이 필요합니다</h1>
                <a href="/login" class="mt-4 block text-sm text-indigo-600 hover:underline">로그인하기</a>
            </div>
        {:else if !isOAuth}
            <div class="text-center">
                <div class="mb-4 text-4xl">✅</div>
                <h1 class="mb-2 text-xl font-bold">일반 계정입니다</h1>
                <p class="text-sm text-muted-foreground">소셜 로그인 계정만 기존 계정과 연결할 수 있습니다.</p>
                <p class="mt-2 text-sm">현재 아이디: <strong>{currentUser.mb_id}</strong></p>
                <a href="/" class="mt-4 block text-sm text-muted-foreground hover:text-foreground">← 홈으로</a>
            </div>
        {:else if success}
            <div class="text-center">
                <div class="mb-4 text-4xl">🎉</div>
                <h1 class="mb-2 text-xl font-bold">계정 연결 완료!</h1>
                <p class="text-sm text-muted-foreground">
                    소셜 계정이 <strong>{linkedId}</strong> 계정과 연결되었습니다.<br/>
                    다시 로그인해주세요.
                </p>
                <a href="/login" class="mt-4 block rounded-lg bg-indigo-600 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500">다시 로그인</a>
            </div>
        {:else}
            <h1 class="mb-2 text-2xl font-bold">계정 연결</h1>
            <p class="mb-2 text-sm text-muted-foreground">
                소셜 로그인 계정을 기존 뮤지아 계정과 연결합니다.
            </p>
            <div class="mb-6 rounded-lg border bg-muted/30 p-3">
                <p class="text-xs text-muted-foreground">현재 로그인: <strong>{currentUser.nickname}</strong> ({currentUser.mb_id})</p>
            </div>

            {#if error}
                <div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300">{error}</div>
            {/if}

            <form onsubmit={(e) => { e.preventDefault(); handleLink(); }}>
                <div class="mb-4">
                    <label class="mb-1 block text-sm font-medium">기존 아이디</label>
                    <input type="text" bind:value={mbId} placeholder="기존 뮤지아 아이디"
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div class="mb-6">
                    <label class="mb-1 block text-sm font-medium">비밀번호</label>
                    <input type="password" bind:value={password} placeholder="기존 계정 비밀번호"
                        class="w-full rounded-lg border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <button type="submit" disabled={loading}
                    class="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                    {loading ? '연결 중...' : '계정 연결'}
                </button>
            </form>
            <p class="mt-4 text-center text-xs text-muted-foreground">비밀번호를 모르시면 <a href="mailto:help@muzia.net" class="text-indigo-600 hover:underline">help@muzia.net</a>으로 문의해주세요.</p>
            <a href="/" class="mt-2 block text-center text-sm text-muted-foreground hover:text-foreground">← 홈으로</a>
        {/if}
    </div>
</div>
