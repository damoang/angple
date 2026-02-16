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
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import UserPlus from '@lucide/svelte/icons/user-plus';
    import { onMount } from 'svelte';
    import { env } from '$env/dynamic/public';

    const PUBLIC_TURNSTILE_SITE_KEY = env.PUBLIC_TURNSTILE_SITE_KEY || '';
    import type { PageData, ActionData } from './$types.js';

    let { data, form }: { data: PageData; form: ActionData } = $props();

    let nickname = $state(form?.nickname || data.displayName || '');
    let agreeTerms = $state(false);
    let agreePrivacy = $state(false);
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

    // 프로바이더 한글명
    const providerNames: Record<string, string> = {
        google: 'Google',
        kakao: '카카오',
        naver: '네이버',
        apple: 'Apple',
        facebook: 'Facebook',
        twitter: 'X (Twitter)',
        payco: 'PAYCO'
    };

    const providerLabel = $derived(providerNames[data.provider] || data.provider);
</script>

<svelte:head>
    <title>회원가입 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">회원가입</CardTitle>
            <CardDescription>
                {providerLabel} 계정으로 가입합니다
                {#if data.email}
                    <br />
                    <span class="text-foreground font-medium">{data.email}</span>
                {/if}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <!-- 에러 메시지 -->
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
                class="space-y-6"
            >
                <input type="hidden" name="redirect" value={data.redirectUrl} />

                <!-- 닉네임 입력 -->
                <div class="space-y-2">
                    <Label for="nickname">닉네임 <span class="text-destructive">*</span></Label>
                    <Input
                        id="nickname"
                        name="nickname"
                        type="text"
                        placeholder="사용할 닉네임을 입력하세요"
                        bind:value={nickname}
                        maxlength={20}
                        minlength={2}
                        required
                        disabled={isSubmitting}
                    />
                    <p class="text-muted-foreground text-xs">
                        한글, 영문, 숫자, 점(.), 밑줄(_) 사용 가능 (2~20자)
                    </p>
                </div>

                <!-- 약관 동의 -->
                <div class="space-y-3">
                    <div class="flex items-start gap-3">
                        <Checkbox
                            id="agree_terms"
                            name="agree_terms"
                            bind:checked={agreeTerms}
                            disabled={isSubmitting}
                        />
                        <div>
                            <Label for="agree_terms" class="cursor-pointer font-normal">
                                <a
                                    href="/terms"
                                    target="_blank"
                                    class="text-primary hover:underline"
                                >
                                    이용약관
                                </a>에 동의합니다
                                <span class="text-destructive">*</span>
                            </Label>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <Checkbox
                            id="agree_privacy"
                            name="agree_privacy"
                            bind:checked={agreePrivacy}
                            disabled={isSubmitting}
                        />
                        <div>
                            <Label for="agree_privacy" class="cursor-pointer font-normal">
                                <a
                                    href="/privacy"
                                    target="_blank"
                                    class="text-primary hover:underline"
                                >
                                    개인정보처리방침
                                </a>에 동의합니다
                                <span class="text-destructive">*</span>
                            </Label>
                        </div>
                    </div>
                </div>

                <!-- Turnstile CAPTCHA -->
                {#if PUBLIC_TURNSTILE_SITE_KEY}
                    <div bind:this={turnstileRef} class="flex justify-center"></div>
                {/if}

                <!-- 가입 버튼 -->
                <Button
                    type="submit"
                    class="w-full"
                    disabled={isSubmitting || !nickname.trim() || !agreeTerms || !agreePrivacy}
                >
                    {#if isSubmitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        가입 중...
                    {:else}
                        <UserPlus class="mr-2 h-4 w-4" />
                        가입하기
                    {/if}
                </Button>
            </form>

            <div class="mt-4 text-center text-sm">
                <span class="text-muted-foreground">이미 계정이 있으신가요?</span>
                <a href="/login" class="text-primary ml-1 hover:underline">로그인</a>
            </div>
        </CardContent>
    </Card>
</div>
