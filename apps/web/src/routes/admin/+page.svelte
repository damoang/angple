<script lang="ts">
    import AdminLoginForm from '$lib/components/admin/auth/login-form.svelte';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    let { data } = $props();

    let checking = $state(true);

    onMount(() => {
        if (!browser) return;

        // 이미 관리자 인증 완료 → 대시보드로 이동
        if (data.isAdmin) {
            window.location.href = '/admin/dashboard';
            return;
        }

        // localStorage 토큰이 있으면 쿠키 동기화 후 새로고침
        const token = localStorage.getItem('access_token');
        const hasCookie = document.cookie.split('; ').some((c) => c.startsWith('access_token='));
        if (token && !hasCookie) {
            document.cookie = `access_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
            window.location.reload();
            return;
        }

        checking = false;
    });
</script>

{#if !checking && !data.isAdmin}
    <div class="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
        <div class="w-full max-w-sm md:max-w-3xl">
            <AdminLoginForm />
        </div>
    </div>
{:else}
    <div class="bg-muted flex min-h-svh items-center justify-center">
        <p class="text-muted-foreground text-sm">인증 확인 중...</p>
    </div>
{/if}
