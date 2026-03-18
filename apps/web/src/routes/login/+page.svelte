<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { OAuthProvider } from '$lib/api/types.js';
    import { trackEvent } from '$lib/services/ga4.js';

    // OAuth 에러 메시지 매핑
    const oauthErrorMessages: Record<string, string> = {
        no_account: '연결된 계정이 없습니다. 소셜 로그인으로 회원가입을 진행해주세요.',
        account_inactive: '탈퇴했거나 이용이 제한된 계정입니다.',
        invalid_state: '인증 세션이 만료되었습니다. 다시 시도해주세요.',
        invalid_provider: '지원하지 않는 로그인 방식입니다.',
        provider_mismatch: '인증 정보가 일치하지 않습니다. 다시 시도해주세요.',
        missing_params: '인증 정보가 누락되었습니다. 다시 시도해주세요.',
        oauth_error: '소셜로그인 처리 중 오류가 발생했습니다.',
        provider_access_denied: '소셜로그인이 취소되었습니다.'
    };

    let error = $state<string | null>(null);
    let isRedirecting = $state(false);

    const redirectUrl = $derived($page.url.searchParams.get('redirect') || '/');
    const isInviteFlow = $derived(redirectUrl.includes('ads.damoang.net/invite/'));

    onMount(() => {
        const oauthError = $page.url.searchParams.get('error');
        if (oauthError) {
            error = oauthErrorMessages[oauthError] || `로그인 오류: ${oauthError}`;
        }

        function checkAndRedirect() {
            if (isRedirecting) return;
            if (!authStore.isLoading && authStore.isAuthenticated) {
                isRedirecting = true;
                window.location.href = redirectUrl;
                return;
            }
            if (authStore.isLoading) {
                setTimeout(checkAndRedirect, 100);
            }
        }
        checkAndRedirect();
    });

    function handleOAuthLogin(provider: OAuthProvider): void {
        trackEvent('login', { method: provider });
        const params = new URLSearchParams({
            provider,
            redirect: redirectUrl
        });
        window.location.href = `/auth/start?${params.toString()}`;
    }

    // 주요 프로바이더 (풀 너비 버튼)
    const mainProviders: {
        id: OAuthProvider;
        name: string;
        bgClass: string;
        textClass: string;
        hoverClass: string;
    }[] = [
        {
            id: 'kakao',
            name: '카카오',
            bgClass: 'bg-[#FEE500]',
            textClass: 'text-[#191919]',
            hoverClass: 'hover:bg-[#FEE500]/90'
        },
        {
            id: 'naver',
            name: '네이버',
            bgClass: 'bg-[#03C75A]',
            textClass: 'text-white',
            hoverClass: 'hover:bg-[#03C75A]/90'
        },
        {
            id: 'google',
            name: 'Google',
            bgClass: 'bg-white border border-border',
            textClass: 'text-gray-700',
            hoverClass: 'hover:bg-gray-50'
        }
    ];

    // 보조 프로바이더 (아이콘 버튼)
    const subProviders: {
        id: OAuthProvider;
        name: string;
        bgClass: string;
        hoverClass: string;
    }[] = [
        {
            id: 'apple',
            name: 'Apple',
            bgClass: 'bg-black dark:bg-white dark:text-black',
            hoverClass: 'hover:bg-black/80 dark:hover:bg-white/80'
        },
        {
            id: 'facebook',
            name: 'Facebook',
            bgClass: 'bg-[#1877F2]',
            hoverClass: 'hover:bg-[#1877F2]/80'
        },
        {
            id: 'twitter',
            name: 'X',
            bgClass: 'bg-black dark:bg-white dark:text-black',
            hoverClass: 'hover:bg-black/80 dark:hover:bg-white/80'
        },
        {
            id: 'payco',
            name: 'PAYCO',
            bgClass: 'bg-[#E42529]',
            hoverClass: 'hover:bg-[#E42529]/80'
        }
    ];

    // 소셜 로그인 버튼 순서 랜덤 셔플 (SSR에서는 기본 순서, 클라이언트에서 셔플)
    function shuffle<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    let shuffledMainProviders = $state(shuffle(mainProviders));
    let shuffledSubProviders = $state(shuffle(subProviders));
</script>

<svelte:head>
    <title>로그인 | {import.meta.env.VITE_SITE_NAME || '다모앙'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-sm shadow-sm">
        <CardContent class="space-y-6 pb-6 pt-8">
            <!-- 헤더 -->
            <div class="text-center">
                <h1 class="text-xl font-bold tracking-tight">
                    {#if isInviteFlow}
                        광고주 가입 / 연동
                    {:else}
                        {import.meta.env.VITE_SITE_NAME || '다모앙'}
                    {/if}
                </h1>
                <p class="text-muted-foreground mt-1 text-sm">
                    {#if isInviteFlow}
                        기존 회원은 로그인으로 연동, 신규 회원은 가입이 진행됩니다
                    {:else}
                        소셜 계정으로 간편하게 로그인하세요
                    {/if}
                </p>
            </div>

            <!-- 에러 메시지 -->
            {#if error}
                <div class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">{error}</div>
            {/if}

            <!-- 주요 소셜 로그인 (풀 너비) -->
            <div class="space-y-2.5">
                {#each shuffledMainProviders as provider}
                    <button
                        class="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98] {provider.bgClass} {provider.textClass} {provider.hoverClass}"
                        onclick={() => handleOAuthLogin(provider.id)}
                    >
                        {#if provider.id === 'kakao'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    fill="#191919"
                                    d="M12 3c-5.065 0-9.167 3.355-9.167 7.5 0 2.625 1.757 4.937 4.403 6.278-.193.705-.7 2.555-.804 2.953-.127.497.182.49.385.357.159-.104 2.534-1.72 3.565-2.42.514.073 1.047.112 1.618.112 5.065 0 9.167-3.355 9.167-7.5S17.065 3 12 3"
                                />
                            </svg>
                        {:else if provider.id === 'naver'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    fill="white"
                                    d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"
                                />
                            </svg>
                        {:else if provider.id === 'google'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                        {/if}
                        {provider.name}로 로그인
                    </button>
                {/each}
            </div>

            <!-- 구분선 -->
            <div class="relative">
                <div class="absolute inset-0 flex items-center">
                    <Separator class="w-full" />
                </div>
                <div class="relative flex justify-center text-xs">
                    <span class="bg-card text-muted-foreground px-3">다른 방법</span>
                </div>
            </div>

            <!-- 보조 소셜 로그인 (아이콘 버튼) -->
            <div class="flex items-center justify-center gap-3">
                {#each shuffledSubProviders as provider}
                    <button
                        class="flex h-11 w-11 items-center justify-center rounded-full text-white transition-all duration-200 active:scale-[0.95] {provider.bgClass} {provider.hoverClass}"
                        onclick={() => handleOAuthLogin(provider.id)}
                        title="{provider.name}로 로그인"
                    >
                        {#if provider.id === 'apple'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                <path
                                    d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                                />
                            </svg>
                        {:else if provider.id === 'facebook'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="white">
                                <path
                                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                                />
                            </svg>
                        {:else if provider.id === 'twitter'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                <path
                                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                                />
                            </svg>
                        {:else if provider.id === 'payco'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="white">
                                <text
                                    x="4"
                                    y="18"
                                    font-size="16"
                                    font-weight="bold"
                                    font-family="Arial">P</text
                                >
                            </svg>
                        {/if}
                    </button>
                {/each}
            </div>

            <!-- 회원가입 안내 -->
            <p class="text-muted-foreground text-center text-xs">
                {#if isInviteFlow}
                    소셜 로그인 후 기존 회원은 자동 연동, 신규 회원은 가입 페이지로 이동합니다
                {:else}
                    계정이 없으신가요? 위 소셜 로그인으로 자동 회원가입됩니다.
                {/if}
            </p>
        </CardContent>
    </Card>
</div>
