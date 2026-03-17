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

    let nickname = $state('');
    let customMbId = $state('');

    $effect(() => {
        nickname = form?.nickname || data.displayName || '';
    });
    let agreeTerms = $state(false);
    let agreePrivacy = $state(false);
    let agreePolicy = $state(false);
    let agreeContract = $state(false);
    let isSubmitting = $state(false);
    let turnstileRef: HTMLDivElement | undefined = $state();
    let turnstileWidgetId: string | undefined = $state();
    let nicknameRef: HTMLDivElement | undefined = $state();

    // 닉네임 관련 에러인지 판별
    const nicknameErrors = ['닉네임', '사용할 수 없는 닉'];
    let isNicknameError = $derived(
        form?.error ? nicknameErrors.some((k) => form!.error!.includes(k)) : false
    );

    // 아이디 관련 에러인지 판별
    const mbIdErrors = ['아이디'];
    let isMbIdError = $derived(
        form?.error ? mbIdErrors.some((k) => form!.error!.includes(k)) : false
    );

    // 에러 발생 시 닉네임 필드로 스크롤
    $effect(() => {
        if (isNicknameError && nicknameRef) {
            nicknameRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    // 약관/개인정보처리방침/이용제한사유 스크롤 끝까지 읽었는지 여부
    let termsScrolled = $state(false);
    let privacyScrolled = $state(false);
    let policyScrolled = $state(false);
    let termsRead = $derived(termsScrolled || !data.termsHtml);
    let privacyRead = $derived(privacyScrolled || !data.privacyHtml);
    let policyRead = $derived(policyScrolled || !data.policyHtml);
    let contractScrolled = $state(false);
    let contractRead = $derived(contractScrolled || !data.contractHtml);

    function handleTermsScroll(e: Event) {
        const el = e.target as HTMLDivElement;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
            termsScrolled = true;
        }
    }

    function handlePrivacyScroll(e: Event) {
        const el = e.target as HTMLDivElement;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
            privacyScrolled = true;
        }
    }

    function handlePolicyScroll(e: Event) {
        const el = e.target as HTMLDivElement;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
            policyScrolled = true;
        }
    }

    function handleContractScroll(e: Event) {
        const el = e.target as HTMLDivElement;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
            contractScrolled = true;
        }
    }

    // Turnstile 렌더링 (에러 시 1회만 재시도)
    let turnstileRetried = false;
    onMount(() => {
        if (PUBLIC_TURNSTILE_SITE_KEY && turnstileRef && window.turnstile) {
            turnstileWidgetId = window.turnstile.render(turnstileRef, {
                sitekey: PUBLIC_TURNSTILE_SITE_KEY,
                theme: 'auto',
                retry: 'auto',
                'retry-interval': 5000,
                'error-callback': () => {
                    if (!turnstileRetried) {
                        turnstileRetried = true;
                        setTimeout(() => {
                            if (turnstileWidgetId !== undefined && window.turnstile) {
                                window.turnstile.reset(turnstileWidgetId);
                            }
                        }, 3000);
                    }
                    return true;
                }
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
    <title
        >{data.isInviteFlow ? '광고주 가입' : '회원가입'} | {import.meta.env.VITE_SITE_NAME ||
            'Angple'}</title
    >
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">
                {#if data.isInviteFlow}
                    광고주 가입
                {:else}
                    회원가입
                {/if}
            </CardTitle>
            <CardDescription>
                {#if data.isInviteFlow}
                    광고 계정 연동을 위한 회원가입입니다
                {:else}
                    {providerLabel} 계정으로 가입합니다
                {/if}
                {#if data.email}
                    <br />
                    <span class="text-foreground font-medium">{data.email}</span>
                {/if}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <!-- 일반 에러 메시지 (닉네임/아이디 외) -->
            {#if form?.error && !isNicknameError && !isMbIdError}
                <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                    {form.error}
                </div>
            {/if}

            <div class="border-border bg-muted/40 mb-6 rounded-lg border p-4 text-sm leading-6">
                <p class="font-semibold">가입 후 안내</p>
                <p class="text-muted-foreground mt-2">
                    닉네임 오른쪽은 <span class="font-medium text-foreground">앙님❤️</span>으로
                    시작합니다.
                </p>
                <p class="text-muted-foreground">
                    7일간 로그인하면 <span class="font-medium text-foreground">앙님💛</span>으로
                    승급됩니다.
                </p>
                <p class="text-muted-foreground">
                    글쓰기와 댓글 작성은 <span class="font-medium text-foreground">앙님💛</span
                    >부터 이용하실 수 있습니다.
                </p>
                <p class="text-muted-foreground mt-2">
                    현재 시스템 안정화로 인해 자동 승급은 일시 중단되었으며, 매주 일요일 수동으로
                    등급을 상향 조정해드리고 있습니다.
                </p>
                <p class="text-muted-foreground">이용에 불편을 드려 죄송합니다.</p>
            </div>

            <form
                method="POST"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ result, update }) => {
                        if (result.type === 'redirect') {
                            window.location.href = result.location;
                            return;
                        }
                        isSubmitting = false;
                        await update();
                    };
                }}
                class="space-y-6"
            >
                <input type="hidden" name="redirect" value={data.redirectUrl} />

                <!-- 이용약관 -->
                <div class="space-y-2">
                    <Label class="font-medium">
                        이용약관 <span class="text-destructive">*</span>
                    </Label>
                    {#if data.termsHtml}
                        <div
                            class="terms-content border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-3 text-xs leading-relaxed"
                            onscroll={handleTermsScroll}
                        >
                            {@html data.termsHtml}
                        </div>
                    {/if}
                    <div class="flex items-center gap-3">
                        <Checkbox
                            id="agree_terms"
                            bind:checked={agreeTerms}
                            disabled={isSubmitting || !termsRead}
                        />
                        <Label
                            for="agree_terms"
                            class="cursor-pointer text-sm {termsRead
                                ? ''
                                : 'text-muted-foreground'}"
                        >
                            {#if termsRead}
                                이용약관에 동의합니다
                            {:else}
                                약관을 끝까지 읽어주세요
                            {/if}
                        </Label>
                    </div>
                </div>

                <!-- 개인정보처리방침 -->
                <div class="space-y-2">
                    <Label class="font-medium">
                        개인정보처리방침 <span class="text-destructive">*</span>
                    </Label>
                    {#if data.privacyHtml}
                        <div
                            class="terms-content border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-3 text-xs leading-relaxed"
                            onscroll={handlePrivacyScroll}
                        >
                            {@html data.privacyHtml}
                        </div>
                    {/if}
                    <div class="flex items-center gap-3">
                        <Checkbox
                            id="agree_privacy"
                            bind:checked={agreePrivacy}
                            disabled={isSubmitting || !privacyRead}
                        />
                        <Label
                            for="agree_privacy"
                            class="cursor-pointer text-sm {privacyRead
                                ? ''
                                : 'text-muted-foreground'}"
                        >
                            {#if privacyRead}
                                개인정보처리방침에 동의합니다
                            {:else}
                                방침을 끝까지 읽어주세요
                            {/if}
                        </Label>
                    </div>
                </div>

                <!-- 이용제한사유 안내 -->
                {#if data.policyHtml}
                    <div class="space-y-2">
                        <Label class="font-medium">
                            이용제한사유 안내 <span class="text-destructive">*</span>
                        </Label>
                        <div
                            class="terms-content border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-3 text-xs leading-relaxed"
                            onscroll={handlePolicyScroll}
                        >
                            {@html data.policyHtml}
                        </div>
                        <div class="flex items-center gap-3">
                            <Checkbox
                                id="agree_policy"
                                bind:checked={agreePolicy}
                                disabled={isSubmitting || !policyRead}
                            />
                            <Label
                                for="agree_policy"
                                class="cursor-pointer text-sm {policyRead
                                    ? ''
                                    : 'text-muted-foreground'}"
                            >
                                {#if policyRead}
                                    이용제한사유 안내에 동의합니다
                                {:else}
                                    안내를 끝까지 읽어주세요
                                {/if}
                            </Label>
                        </div>
                    </div>
                {/if}

                <!-- 광고주 약관 (초대 플로우) -->
                {#if data.isInviteFlow && data.contractHtml}
                    <div class="space-y-2">
                        <Label class="font-medium">
                            광고주 약관 <span class="text-destructive">*</span>
                        </Label>
                        <div
                            class="terms-content border-border bg-muted/30 max-h-48 overflow-y-auto rounded-md border p-3 text-xs leading-relaxed"
                            onscroll={handleContractScroll}
                        >
                            {@html data.contractHtml}
                        </div>
                        <div class="flex items-center gap-3">
                            <Checkbox
                                id="agree_contract"
                                bind:checked={agreeContract}
                                disabled={isSubmitting || !contractRead}
                            />
                            <Label
                                for="agree_contract"
                                class="cursor-pointer text-sm {contractRead
                                    ? ''
                                    : 'text-muted-foreground'}"
                            >
                                {#if contractRead}
                                    광고주 약관에 동의합니다
                                {:else}
                                    약관을 끝까지 읽어주세요
                                {/if}
                            </Label>
                        </div>
                    </div>
                {/if}

                <!-- 아이디 입력 (초대 플로우) -->
                {#if data.isInviteFlow}
                    <div class="space-y-2">
                        <Label for="mb_id">아이디 <span class="text-destructive">*</span></Label>
                        <Input
                            id="mb_id"
                            name="mb_id"
                            type="text"
                            placeholder="사용할 아이디를 입력하세요"
                            bind:value={customMbId}
                            maxlength={20}
                            minlength={3}
                            required
                            disabled={isSubmitting}
                            class={isMbIdError ? 'border-destructive' : ''}
                        />
                        {#if isMbIdError}
                            <p class="text-destructive text-xs font-medium">{form?.error}</p>
                        {/if}
                        <p class="text-muted-foreground text-xs">
                            영문 소문자, 숫자, 밑줄(_) 사용 가능 (3~20자)
                        </p>
                    </div>
                {/if}

                <!-- 닉네임 입력 -->
                <div class="space-y-2" bind:this={nicknameRef}>
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
                        class={isNicknameError ? 'border-destructive' : ''}
                    />
                    {#if isNicknameError}
                        <p class="text-destructive text-xs font-medium">{form?.error}</p>
                    {/if}
                    <p class="text-muted-foreground text-xs">
                        한글, 영문, 숫자, 점(.), 밑줄(_) 사용 가능 (2~20자)
                    </p>
                </div>

                <!-- 체크박스 값 전송용 hidden input -->
                {#if agreeTerms}
                    <input type="hidden" name="agree_terms" value="on" />
                {/if}
                {#if agreePrivacy}
                    <input type="hidden" name="agree_privacy" value="on" />
                {/if}
                {#if agreePolicy}
                    <input type="hidden" name="agree_policy" value="on" />
                {/if}
                {#if agreeContract}
                    <input type="hidden" name="agree_contract" value="on" />
                {/if}
                <!-- Turnstile CAPTCHA (초대 플로우는 스킵) -->
                {#if PUBLIC_TURNSTILE_SITE_KEY && !data.isInviteFlow}
                    <div bind:this={turnstileRef} class="flex justify-center"></div>
                {/if}

                <!-- 가입 버튼 -->
                <Button
                    type="submit"
                    class="w-full"
                    disabled={isSubmitting ||
                        !nickname.trim() ||
                        !agreeTerms ||
                        !agreePrivacy ||
                        (!!data.policyHtml && !agreePolicy) ||
                        (data.isInviteFlow && !!data.contractHtml && !agreeContract) ||
                        (data.isInviteFlow && !customMbId.trim())}
                >
                    {#if isSubmitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        가입 중...
                    {:else}
                        <UserPlus class="mr-2 h-4 w-4" />
                        {#if data.isInviteFlow}
                            가입 및 연동하기
                        {:else}
                            가입하기
                        {/if}
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

<style>
    .terms-content :global(h1),
    .terms-content :global(h2),
    .terms-content :global(h3) {
        font-weight: 600;
        margin-top: 0.75rem;
        margin-bottom: 0.25rem;
    }

    .terms-content :global(p) {
        margin-bottom: 0.5rem;
    }

    .terms-content :global(ul),
    .terms-content :global(ol) {
        padding-left: 1.25rem;
        margin-bottom: 0.5rem;
    }

    .terms-content :global(li) {
        margin-bottom: 0.25rem;
    }
</style>
