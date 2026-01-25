<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { OAuthProvider } from '$lib/api/types.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import AlertCircle from '@lucide/svelte/icons/alert-circle';

    let isLoading = $state(true);
    let error = $state<string | null>(null);

    onMount(async () => {
        if (!browser) return;

        const provider = $page.params.provider as OAuthProvider;
        const code = $page.url.searchParams.get('code');
        const errorParam = $page.url.searchParams.get('error');

        if (errorParam) {
            error = `OAuth 인증 실패: ${errorParam}`;
            isLoading = false;
            return;
        }

        if (!code) {
            error = '인증 코드가 없습니다.';
            isLoading = false;
            return;
        }

        try {
            // OAuth 콜백 처리
            await apiClient.handleOAuthCallback({
                provider,
                code,
                redirect_uri: `${window.location.origin}/auth/callback/${provider}`
            });

            // 인증 상태 갱신
            await authActions.fetchCurrentUser();

            // 저장된 리다이렉트 URL로 이동
            const redirectUrl = sessionStorage.getItem('oauth_redirect') || '/';
            sessionStorage.removeItem('oauth_redirect');

            goto(redirectUrl);
        } catch (err) {
            console.error('OAuth callback error:', err);
            error = err instanceof Error ? err.message : 'OAuth 인증 처리 중 오류가 발생했습니다.';
            isLoading = false;
        }
    });
</script>

<svelte:head>
    <title>로그인 처리 중... | 다모앙</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4">
    <div class="text-center">
        {#if isLoading}
            <Loader2 class="text-primary mx-auto h-12 w-12 animate-spin" />
            <p class="text-muted-foreground mt-4 text-lg">로그인 처리 중...</p>
        {:else if error}
            <AlertCircle class="text-destructive mx-auto h-12 w-12" />
            <p class="text-destructive mt-4 text-lg">{error}</p>
            <a
                href="/login"
                class="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-block rounded-md px-6 py-2"
            >
                로그인 페이지로 돌아가기
            </a>
        {/if}
    </div>
</div>
