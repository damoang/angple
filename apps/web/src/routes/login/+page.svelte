<script lang="ts">
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { authStore, authActions } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { OAuthProvider } from '$lib/api/types.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import LogIn from '@lucide/svelte/icons/log-in';
    import Mail from '@lucide/svelte/icons/mail';
    import Lock from '@lucide/svelte/icons/lock';
    import ExternalLink from '@lucide/svelte/icons/external-link';

    // 성공 메시지 매핑
    const successMessages: Record<string, string> = {
        password_reset_success: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.'
    };

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

    // 폼 상태
    let mbId = $state('');
    let mbPassword = $state('');
    let remember = $state(false);
    let isLoading = $state(false);
    let error = $state<string | null>(null);
    let isRedirecting = $state(false);

    // 리다이렉트 URL
    const redirectUrl = $derived($page.url.searchParams.get('redirect') || '/');

    // 이미 로그인되어 있으면 리다이렉트
    // onMount에서 폴링하여 컴포넌트 트리가 완전히 마운트된 후에만 리다이렉트
    // 성공 메시지 상태
    let successMessage = $state<string | null>(null);

    onMount(() => {
        // OAuth 에러 메시지 표시
        const oauthError = $page.url.searchParams.get('error');
        if (oauthError) {
            error = oauthErrorMessages[oauthError] || `로그인 오류: ${oauthError}`;
        }

        // 성공 메시지 표시 (비밀번호 변경 등)
        const message = $page.url.searchParams.get('message');
        if (message) {
            successMessage = successMessages[message] || null;
        }


        // OAuth 로그인 성공 시 access_token 쿠키 처리
        const atCookie = document.cookie.split('; ').find((r) => r.startsWith('access_token='));
        if (atCookie) {
            const token = atCookie.split('=')[1];
            if (token) {
                apiClient.setAccessToken(token);
                // 쿠키 삭제 (메모리로 이동 완료)
                document.cookie = 'access_token=; path=/; max-age=0';
            }
        }

        function checkAndRedirect() {
            if (isRedirecting) return;
            if (!authStore.isLoading && authStore.isAuthenticated) {
                isRedirecting = true;
                window.location.href = redirectUrl;
                return;
            }
            // auth 로딩 중이면 100ms 후 재확인
            if (authStore.isLoading) {
                setTimeout(checkAndRedirect, 100);
            }
        }
        checkAndRedirect();
    });

    // 아이디/비밀번호 로그인
    async function handleLogin(e: Event): Promise<void> {
        e.preventDefault();

        if (!mbId.trim() || !mbPassword.trim()) {
            error = '아이디와 비밀번호를 입력해주세요.';
            return;
        }

        isLoading = true;
        error = null;

        try {
            await apiClient.login({
                user_id: mbId,
                password: mbPassword,
                remember
            });

            // 풀 페이지 리로드로 리다이렉트 (Svelte 내부 라우팅 race condition 방지)
            window.location.href = redirectUrl;
        } catch (err) {
            console.error('Login failed:', err);
            error = err instanceof Error ? err.message : '로그인에 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }

    // OAuth 로그인 (서버사이드 처리 → /plugin/social/start)
    function handleOAuthLogin(provider: OAuthProvider): void {
        const params = new URLSearchParams({
            provider,
            redirect: redirectUrl
        });
        window.location.href = `/plugin/social/start?${params.toString()}`;
    }

    // JWT 로그인 (기존 damoang.net 로그인 활용 - 마이그레이션 완료 전까지)
    function handleJwtLogin(): void {
        const currentUrl = browser ? window.location.href : 'https://web.damoang.net';
        window.location.href = `https://damoang.net/bbs/login.php?url=${encodeURIComponent(currentUrl)}`;
    }

    // OAuth 프로바이더 설정
    const oauthProviders: {
        id: OAuthProvider;
        name: string;
        bgClass: string;
        textClass: string;
        hoverClass: string;
        icon: string;
    }[] = [
        {
            id: 'google',
            name: 'Google',
            bgClass: 'bg-white border',
            textClass: 'text-gray-700',
            hoverClass: 'hover:bg-gray-50',
            icon: 'google'
        },
        {
            id: 'kakao',
            name: '카카오',
            bgClass: 'bg-[#FEE500]',
            textClass: 'text-[#191919]',
            hoverClass: 'hover:bg-[#FEE500]/90',
            icon: 'kakao'
        },
        {
            id: 'naver',
            name: '네이버',
            bgClass: 'bg-[#03C75A]',
            textClass: 'text-white',
            hoverClass: 'hover:bg-[#03C75A]/90',
            icon: 'naver'
        },
        {
            id: 'apple',
            name: 'Apple',
            bgClass: 'bg-black',
            textClass: 'text-white',
            hoverClass: 'hover:bg-black/90',
            icon: 'apple'
        },
        {
            id: 'facebook',
            name: 'Facebook',
            bgClass: 'bg-[#1877F2]',
            textClass: 'text-white',
            hoverClass: 'hover:bg-[#1877F2]/90',
            icon: 'facebook'
        },
        {
            id: 'twitter',
            name: 'X (Twitter)',
            bgClass: 'bg-black',
            textClass: 'text-white',
            hoverClass: 'hover:bg-black/90',
            icon: 'twitter'
        },
        {
            id: 'payco',
            name: 'PAYCO',
            bgClass: 'bg-[#E42529]',
            textClass: 'text-white',
            hoverClass: 'hover:bg-[#E42529]/90',
            icon: 'payco'
        }
    ];
</script>

<svelte:head>
    <title>로그인 | 다모앙</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">로그인</CardTitle>
            <CardDescription>다모앙에 오신 것을 환영합니다</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
            <!-- 성공 메시지 -->
            {#if successMessage}
                <div
                    class="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400"
                >
                    {successMessage}
                </div>
            {/if}


            <!-- OAuth 에러 메시지 -->
            {#if error && !import.meta.env.DEV}
                <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                    {error}
                </div>
            {/if}

            <!-- OAuth 로그인 버튼들 -->
            <div class="space-y-3">
                {#each oauthProviders as provider}
                    <button
                        class="flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors {provider.bgClass} {provider.textClass} {provider.hoverClass}"
                        onclick={() => handleOAuthLogin(provider.id)}
                    >
                        {#if provider.icon === 'google'}
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
                        {:else if provider.icon === 'kakao'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    fill="#191919"
                                    d="M12 3c-5.065 0-9.167 3.355-9.167 7.5 0 2.625 1.757 4.937 4.403 6.278-.193.705-.7 2.555-.804 2.953-.127.497.182.49.385.357.159-.104 2.534-1.72 3.565-2.42.514.073 1.047.112 1.618.112 5.065 0 9.167-3.355 9.167-7.5S17.065 3 12 3"
                                />
                            </svg>
                        {:else if provider.icon === 'naver'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    fill="white"
                                    d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"
                                />
                            </svg>
                        {:else if provider.icon === 'apple'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="white">
                                <path
                                    d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                                />
                            </svg>
                        {:else if provider.icon === 'facebook'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="white">
                                <path
                                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                                />
                            </svg>
                        {:else if provider.icon === 'twitter'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="white">
                                <path
                                    d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                                />
                            </svg>
                        {:else if provider.icon === 'payco'}
                            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="white">
                                <text
                                    x="2"
                                    y="18"
                                    font-size="14"
                                    font-weight="bold"
                                    font-family="Arial">P</text
                                >
                            </svg>
                        {/if}
                        {provider.name}으로 로그인
                    </button>
                {/each}
            </div>

            <!-- JWT 직접 로그인 버튼 -->
            <div>
                <Separator class="mb-4" />
                <Button variant="outline" class="w-full" onclick={handleJwtLogin}>
                    <ExternalLink class="mr-2 h-4 w-4" />
                    JWT 로그인 (백엔드)
                </Button>
            </div>

            {#if import.meta.env.DEV}
                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <Separator class="w-full" />
                    </div>
                    <div class="relative flex justify-center text-xs uppercase">
                        <span class="bg-card text-muted-foreground px-2">개발 전용</span>
                    </div>
                </div>

                <!-- 아이디/비밀번호 로그인 폼 (DEV 전용) -->
                <form onsubmit={handleLogin} class="space-y-4">
                    {#if error}
                        <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                            {error}
                        </div>
                    {/if}

                    <div class="space-y-2">
                        <Label for="mb_id">아이디</Label>
                        <div class="relative">
                            <Mail
                                class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            />
                            <Input
                                id="mb_id"
                                type="text"
                                placeholder="아이디를 입력하세요"
                                bind:value={mbId}
                                class="pl-10"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="mb_password">비밀번호</Label>
                        <div class="relative">
                            <Lock
                                class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            />
                            <Input
                                id="mb_password"
                                type="password"
                                placeholder="비밀번호를 입력하세요"
                                bind:value={mbPassword}
                                class="pl-10"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <Checkbox id="remember" bind:checked={remember} />
                            <Label for="remember" class="cursor-pointer text-sm font-normal">
                                로그인 유지
                            </Label>
                        </div>
                        <a href="/password-reset" class="text-primary text-sm hover:underline">
                            비밀번호 찾기
                        </a>
                    </div>

                    <Button type="submit" class="w-full" disabled={isLoading}>
                        {#if isLoading}
                            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                            로그인 중...
                        {:else}
                            <LogIn class="mr-2 h-4 w-4" />
                            로그인
                        {/if}
                    </Button>
                </form>
            {/if}

            <div class="text-center text-sm">
                <span class="text-muted-foreground">계정이 없으신가요?</span>
                <a href="/register" class="text-primary ml-1 hover:underline"> 회원가입 </a>
            </div>
        </CardContent>
    </Card>
</div>
