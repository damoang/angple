<script lang="ts">
    import { browser } from '$app/environment';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { cn } from '$lib/utils.js';
    import { apiClient } from '$lib/api';
    import type { HTMLAttributes } from 'svelte/elements';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ExternalLink from '@lucide/svelte/icons/external-link';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        class?: string;
        id?: string;
    }

    let { class: className, id = 'admin-login-form', ...restProps }: Props = $props();

    let email = $state('');
    let password = $state('');
    let isSubmitting = $state(false);
    let errorMessage = $state('');
    let isExchanging = $state(false);

    const redirectTo = $derived($page.url.searchParams.get('redirect') || '/admin');

    // 레거시 시스템 로그인 후 리다이렉트된 경우 자동 토큰 교환
    // (레거시 SSO 쿠키는 httpOnly라서 JS에서 읽을 수 없음 → URL 파라미터로 판단)
    onMount(async () => {
        if (!browser) return;

        // login=success 파라미터가 있으면 damoang.net에서 로그인 후 리다이렉트된 것
        const loginSuccess = $page.url.searchParams.get('login') === 'success';
        if (!loginSuccess) return;

        isExchanging = true;
        try {
            const resp = await apiClient.exchangeToken();
            if (resp.access_token) {
                // 토큰 교환 성공 → 리다이렉트
                window.location.href = redirectTo;
            }
        } catch {
            // 토큰 교환 실패 시 일반 로그인 폼 표시
            errorMessage = '다모앙 로그인 연동에 실패했습니다. 직접 로그인해 주세요.';
            isExchanging = false;
        }
    });

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (isSubmitting) return;

        isSubmitting = true;
        errorMessage = '';

        try {
            await apiClient.login({ user_id: email, password });
            // 로그인 성공 → 리다이렉트 (서버에서 관리자 여부 재검증)
            window.location.href = redirectTo;
        } catch (err) {
            errorMessage =
                err instanceof Error
                    ? err.message
                    : '로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.';
        } finally {
            isSubmitting = false;
        }
    }

    // JWT 로그인 (기존 damoang.net 로그인 활용)
    function handleJwtLogin(): void {
        const currentUrl = browser ? window.location.href : 'https://web.damoang.net/admin';
        window.location.href = `https://damoang.net/bbs/login.php?url=${encodeURIComponent(currentUrl)}`;
    }
</script>

<div class={cn('flex flex-col gap-6', className)} {...restProps}>
    <Card.Root class="overflow-hidden p-0">
        <Card.Content class="grid p-0 md:grid-cols-2">
            {#if isExchanging}
                <div class="flex flex-col items-center justify-center p-6 md:p-8">
                    <Loader2 class="mb-4 h-8 w-8 animate-spin" />
                    <p class="text-muted-foreground">다모앙 계정 확인 중...</p>
                </div>
            {:else}
                <form class="p-6 md:p-8" onsubmit={handleSubmit}>
                    <div class="flex flex-col gap-6">
                        <div class="flex flex-col items-center text-center">
                            <h1 class="text-2xl font-bold">Angple Admin</h1>
                            <p class="text-muted-foreground text-balance">관리자 계정으로 로그인</p>
                        </div>

                        {#if errorMessage}
                            <div
                                class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
                            >
                                {errorMessage}
                            </div>
                        {/if}

                        <div class="grid gap-3">
                            <Label for="email-{id}">이메일</Label>
                            <Input
                                id="email-{id}"
                                type="email"
                                placeholder="admin@example.com"
                                required
                                bind:value={email}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div class="grid gap-3">
                            <div class="flex items-center">
                                <Label for="password-{id}">비밀번호</Label>
                            </div>
                            <Input
                                id="password-{id}"
                                type="password"
                                required
                                bind:value={password}
                                disabled={isSubmitting}
                            />
                        </div>
                        <Button type="submit" class="w-full" disabled={isSubmitting}>
                            {#if isSubmitting}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                로그인 중...
                            {:else}
                                로그인
                            {/if}
                        </Button>

                        <div class="relative">
                            <div class="absolute inset-0 flex items-center">
                                <Separator class="w-full" />
                            </div>
                            <div class="relative flex justify-center text-xs uppercase">
                                <span class="bg-card text-muted-foreground px-2">또는</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            class="w-full"
                            onclick={handleJwtLogin}
                        >
                            <ExternalLink class="mr-2 h-4 w-4" />
                            다모앙 계정으로 로그인
                        </Button>
                    </div>
                </form>
            {/if}
            <div class="bg-muted relative hidden items-center justify-center md:flex">
                <div class="p-8 text-center">
                    <h2 class="mb-4 text-4xl font-bold">Angple</h2>
                    <p class="text-muted-foreground">커뮤니티를 위한 오픈소스 플랫폼</p>
                </div>
            </div>
        </Card.Content>
    </Card.Root>
    <div class="text-muted-foreground text-balance text-center text-xs">Powered by Angple</div>
</div>
