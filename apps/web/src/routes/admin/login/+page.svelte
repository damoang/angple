<script lang="ts">
    import LoginForm from '$lib/components/admin/auth/login-form.svelte';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';

    /**
     * 관리자 로그인 페이지
     *
     * 이미 웹에서 로그인되어 있으면 (localStorage에 토큰 존재)
     * 쿠키로 동기화 후 자동 리다이렉트
     */

    let checking = $state(true);

    onMount(() => {
        if (!browser) return;

        const token = localStorage.getItem('access_token');
        const hasCookie = document.cookie.split('; ').some((c) => c.startsWith('access_token='));

        if (token && !hasCookie) {
            // 쿠키에 토큰 동기화 후 리다이렉트 → 서버에서 관리자 여부 재검증
            document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
            const redirectTo = $page.url.searchParams.get('redirect') || '/admin';
            window.location.href = redirectTo;
            return;
        }

        checking = false;
    });
</script>

<svelte:head>
    <title>Angple Admin - 로그인</title>
</svelte:head>

{#if !checking}
    <div class="bg-muted flex min-h-screen items-center justify-center p-4">
        <div class="w-full max-w-3xl">
            <LoginForm />
        </div>
    </div>
{:else}
    <div class="bg-muted flex min-h-screen items-center justify-center">
        <p class="text-muted-foreground text-sm">인증 확인 중...</p>
    </div>
{/if}
