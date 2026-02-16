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
    import Lock from '@lucide/svelte/icons/lock';
    import type { ActionData } from './$types.js';

    let { form }: { form: ActionData } = $props();

    let password = $state('');
    let passwordConfirm = $state('');
    let isSubmitting = $state(false);

    const passwordsMatch = $derived(password === passwordConfirm);
    const hasLetterAndNumber = $derived(/[a-zA-Z]/.test(password) && /\d/.test(password));
    const isValid = $derived(password.length >= 8 && hasLetterAndNumber && passwordsMatch);
</script>

<svelte:head>
    <title>비밀번호 재설정 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">새 비밀번호 설정</CardTitle>
            <CardDescription>새로운 비밀번호를 입력해주세요</CardDescription>
        </CardHeader>
        <CardContent>
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
                    <Label for="password">새 비밀번호</Label>
                    <div class="relative">
                        <Lock
                            class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        />
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="8자 이상, 영문+숫자 혼합"
                            bind:value={password}
                            class="pl-10"
                            minlength={8}
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    {#if password && (password.length < 8 || !hasLetterAndNumber)}
                        <p class="text-muted-foreground text-xs">
                            8자 이상, 영문과 숫자를 모두 포함해주세요.
                        </p>
                    {/if}
                </div>

                <div class="space-y-2">
                    <Label for="password_confirm">비밀번호 확인</Label>
                    <div class="relative">
                        <Lock
                            class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        />
                        <Input
                            id="password_confirm"
                            name="password_confirm"
                            type="password"
                            placeholder="비밀번호 재입력"
                            bind:value={passwordConfirm}
                            class="pl-10"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    {#if passwordConfirm && !passwordsMatch}
                        <p class="text-destructive text-xs">비밀번호가 일치하지 않습니다.</p>
                    {/if}
                </div>

                <Button type="submit" class="w-full" disabled={isSubmitting || !isValid}>
                    {#if isSubmitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        변경 중...
                    {:else}
                        비밀번호 변경
                    {/if}
                </Button>
            </form>
        </CardContent>
    </Card>
</div>
