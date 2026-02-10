<script lang="ts">
    import { enhance } from '$app/forms';
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
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Mail from '@lucide/svelte/icons/mail';
    import Check from '@lucide/svelte/icons/check';
    import { onMount } from 'svelte';
    import { env } from '$env/dynamic/public';

    const PUBLIC_TURNSTILE_SITE_KEY = env.PUBLIC_TURNSTILE_SITE_KEY || '';
    import type { ActionData } from './$types.js';

    let { form }: { form: ActionData } = $props();

    let email = $state(form?.email || '');
    let isSubmitting = $state(false);
    let turnstileRef: HTMLDivElement | undefined = $state();

    // Turnstile 렌더링
    onMount(() => {
        if (PUBLIC_TURNSTILE_SITE_KEY && turnstileRef && window.turnstile) {
            window.turnstile.render(turnstileRef, {
                sitekey: PUBLIC_TURNSTILE_SITE_KEY,
                theme: 'auto'
            });
        }
    });
</script>

<svelte:head>
    <title>비밀번호 찾기 | 다모앙</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">비밀번호 찾기</CardTitle>
            <CardDescription>가입 시 사용한 이메일을 입력해주세요</CardDescription>
        </CardHeader>
        <CardContent>
            {#if form?.success}
                <div class="space-y-4 text-center">
                    <div
                        class="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                    >
                        <Check class="text-primary h-8 w-8" />
                    </div>
                    <p class="text-foreground font-medium">이메일이 발송되었습니다</p>
                    <p class="text-muted-foreground text-sm">
                        <strong>{form.email}</strong>으로 비밀번호 재설정 링크를 발송했습니다.
                        이메일을 확인해주세요.
                    </p>
                    <p class="text-muted-foreground text-xs">
                        이메일이 도착하지 않으면 스팸 폴더를 확인하거나 다시 시도해주세요.
                    </p>
                    <Button variant="outline" class="mt-4" onclick={() => (form = null)}>
                        다시 시도
                    </Button>
                </div>
            {:else}
                {#if form?.error}
                    <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                        {form.error}
                    </div>
                {/if}

                <form
                    method="POST"
                    use:enhance={() => {
                        isSubmitting = true;
                        return async ({ update }) => {
                            isSubmitting = false;
                            await update();
                        };
                    }}
                    class="space-y-4"
                >
                    <div class="space-y-2">
                        <Label for="email">이메일</Label>
                        <div class="relative">
                            <Mail
                                class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            />
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="가입 시 사용한 이메일"
                                bind:value={email}
                                class="pl-10"
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <!-- Turnstile CAPTCHA -->
                    {#if PUBLIC_TURNSTILE_SITE_KEY}
                        <div bind:this={turnstileRef} class="flex justify-center"></div>
                    {/if}

                    <Button type="submit" class="w-full" disabled={isSubmitting || !email.trim()}>
                        {#if isSubmitting}
                            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                            발송 중...
                        {:else}
                            재설정 링크 발송
                        {/if}
                    </Button>
                </form>
            {/if}

            <div class="mt-4 text-center text-sm">
                <a href="/login" class="text-primary hover:underline">로그인으로 돌아가기</a>
            </div>
        </CardContent>
    </Card>
</div>
