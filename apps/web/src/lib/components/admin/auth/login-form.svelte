<script lang="ts">
    import * as Card from '$lib/components/ui/card/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { cn } from '$lib/utils.js';
    import { apiClient } from '$lib/api';
    import type { HTMLAttributes } from 'svelte/elements';
    import { page } from '$app/stores';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    interface Props extends HTMLAttributes<HTMLDivElement> {
        class?: string;
        id?: string;
    }

    let { class: className, id = 'admin-login-form', ...restProps }: Props = $props();

    let email = $state('');
    let password = $state('');
    let isSubmitting = $state(false);
    let errorMessage = $state('');

    const redirectTo = $derived($page.url.searchParams.get('redirect') || '/admin');

    async function handleSubmit(e: SubmitEvent) {
        e.preventDefault();
        if (isSubmitting) return;

        isSubmitting = true;
        errorMessage = '';

        try {
            await apiClient.login({ email, password });
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
</script>

<div class={cn('flex flex-col gap-6', className)} {...restProps}>
    <Card.Root class="overflow-hidden p-0">
        <Card.Content class="grid p-0 md:grid-cols-2">
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
                </div>
            </form>
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
