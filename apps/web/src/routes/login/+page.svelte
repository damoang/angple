<script lang="ts">
    import { goto } from '$app/navigation';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card/index.js';
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

    // 폼 상태
    let mbId = $state('');
    let mbPassword = $state('');
    let remember = $state(false);
    let isLoading = $state(false);
    let error = $state<string | null>(null);

    // 리다이렉트 URL
    const redirectUrl = $derived($page.url.searchParams.get('redirect') || '/');

    // 이미 로그인되어 있으면 리다이렉트
    $effect(() => {
        if (browser && !authStore.isLoading && authStore.isAuthenticated) {
            goto(redirectUrl);
        }
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
            const response = await apiClient.login({
                user_id: mbId,
                password: mbPassword,
                remember
            });

            // 인증 상태 갱신
            await authActions.fetchCurrentUser();

            // 리다이렉트
            goto(redirectUrl);
        } catch (err) {
            console.error('Login failed:', err);
            error = err instanceof Error ? err.message : '로그인에 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }

    // OAuth 로그인
    function handleOAuthLogin(provider: OAuthProvider): void {
        // 현재 redirect URL을 세션에 저장
        if (browser) {
            sessionStorage.setItem('oauth_redirect', redirectUrl);
        }

        // OAuth 로그인 페이지로 이동
        window.location.href = apiClient.getOAuthLoginUrl(provider);
    }
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
            <!-- OAuth 로그인 버튼들 -->
            <div class="space-y-3">
                <Button
                    variant="outline"
                    class="w-full"
                    onclick={() => handleOAuthLogin('google')}
                >
                    <svg class="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
                    Google로 로그인
                </Button>

                <Button
                    variant="outline"
                    class="w-full bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90"
                    onclick={() => handleOAuthLogin('kakao')}
                >
                    <svg class="mr-2 h-5 w-5" viewBox="0 0 24 24">
                        <path
                            fill="#191919"
                            d="M12 3c-5.065 0-9.167 3.355-9.167 7.5 0 2.625 1.757 4.937 4.403 6.278-.193.705-.7 2.555-.804 2.953-.127.497.182.49.385.357.159-.104 2.534-1.72 3.565-2.42.514.073 1.047.112 1.618.112 5.065 0 9.167-3.355 9.167-7.5S17.065 3 12 3"
                        />
                    </svg>
                    카카오로 로그인
                </Button>

                <Button
                    variant="outline"
                    class="w-full bg-[#03C75A] text-white hover:bg-[#03C75A]/90"
                    onclick={() => handleOAuthLogin('naver')}
                >
                    <svg class="mr-2 h-5 w-5" viewBox="0 0 24 24">
                        <path
                            fill="white"
                            d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"
                        />
                    </svg>
                    네이버로 로그인
                </Button>
            </div>

            <div class="relative">
                <div class="absolute inset-0 flex items-center">
                    <Separator class="w-full" />
                </div>
                <div class="relative flex justify-center text-xs uppercase">
                    <span class="bg-card text-muted-foreground px-2">또는</span>
                </div>
            </div>

            <!-- 아이디/비밀번호 로그인 폼 -->
            <form onsubmit={handleLogin} class="space-y-4">
                {#if error}
                    <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                        {error}
                    </div>
                {/if}

                <div class="space-y-2">
                    <Label for="mb_id">아이디</Label>
                    <div class="relative">
                        <Mail class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
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
                        <Lock class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
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
                        <Label for="remember" class="text-sm font-normal cursor-pointer">
                            로그인 유지
                        </Label>
                    </div>
                    <a href="/forgot-password" class="text-primary text-sm hover:underline">
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

            <div class="text-center text-sm">
                <span class="text-muted-foreground">계정이 없으신가요?</span>
                <a href="/register" class="text-primary ml-1 hover:underline">
                    회원가입
                </a>
            </div>
        </CardContent>
    </Card>
</div>
