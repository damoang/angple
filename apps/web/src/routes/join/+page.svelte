<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount, onDestroy } from 'svelte';
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
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import UserPlus from '@lucide/svelte/icons/user-plus';
    import Check from '@lucide/svelte/icons/check';
    import X from '@lucide/svelte/icons/x';
    import Eye from '@lucide/svelte/icons/eye';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import { env } from '$env/dynamic/public';
    import type { PageData } from './$types.js';

    const PUBLIC_TURNSTILE_SITE_KEY = env.PUBLIC_TURNSTILE_SITE_KEY || '';

    let { data }: { data: PageData } = $props();

    // 실명인증 설정
    const certEnabled = data.certEnabled;
    const certRequired = data.certRequired;

    // 총 스텝 수 계산 (인증 활성화 시 4단계, 아닐 시 3단계)
    const totalSteps = certEnabled ? 4 : 3;

    // 스텝 매핑: 실명인증이 없으면 스텝2를 건너뜀
    function getStepLabel(step: number): string {
        if (certEnabled) {
            if (step === 1) return '약관 동의';
            if (step === 2) return '본인 인증';
            if (step === 3) return '정보 입력';
            return '가입 완료';
        }
        if (step === 1) return '약관 동의';
        if (step === 2) return '정보 입력';
        return '가입 완료';
    }

    // 폼 입력 스텝 번호
    const formStep = certEnabled ? 3 : 2;
    const completeStep = certEnabled ? 4 : 3;

    // Step management
    let currentStep = $state(1);

    // Step 1: Terms
    let agreeTerms = $state(false);
    let agreePrivacy = $state(false);
    const canProceedStep1 = $derived(agreeTerms && agreePrivacy);

    // Step 2 (cert): 실명인증 상태
    let certCompleted = $state(false);
    let certName = $state('');
    let certPhone = $state('');
    let certAdult = $state(false);

    // SSR에서 전달된 인증 데이터가 있으면 반영
    $effect(() => {
        if (data.certData && data.certData.certNo) {
            certCompleted = true;
            certName = data.certData.name || '';
            certPhone = data.certData.phone || '';
            certAdult = data.certData.adult || false;
            // 인증 완료된 이름을 폼에 반영
            if (certName) mbName = certName;
        }
    });

    // Step (form): Form fields
    let mbId = $state('');
    let mbPassword = $state('');
    let mbPasswordConfirm = $state('');
    let mbName = $state('');
    let mbNick = $state('');
    let mbEmail = $state('');
    let showPassword = $state(false);
    let showPasswordConfirm = $state(false);
    let isSubmitting = $state(false);
    let submitError = $state('');

    // Validation states
    type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid';

    let idValidation = $state<ValidationState>('idle');
    let idMessage = $state('');
    let nickValidation = $state<ValidationState>('idle');
    let nickMessage = $state('');
    let emailValidation = $state<ValidationState>('idle');
    let emailMessage = $state('');

    // Debounce timers
    let idTimer: ReturnType<typeof setTimeout> | undefined;
    let nickTimer: ReturnType<typeof setTimeout> | undefined;
    let emailTimer: ReturnType<typeof setTimeout> | undefined;

    // Turnstile
    let turnstileRef: HTMLDivElement | undefined = $state();
    let turnstileWidgetId: string | undefined = $state();

    // Complete step
    let redirectCountdown = $state(3);

    // --- Validation rules ---

    const idPattern = /^[a-zA-Z0-9_]{3,20}$/;
    const nickPattern = /^[가-힣a-zA-Z0-9._]{2,20}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Password strength
    const passwordStrength = $derived.by(() => {
        if (mbPassword.length === 0) return { level: 0, label: '', color: '' };
        if (mbPassword.length < 4) return { level: 0, label: '너무 짧음', color: 'bg-destructive' };

        let score = 0;
        if (mbPassword.length >= 8) score++;
        if (mbPassword.length >= 12) score++;
        if (/[a-z]/.test(mbPassword) && /[A-Z]/.test(mbPassword)) score++;
        if (/[0-9]/.test(mbPassword)) score++;
        if (/[^a-zA-Z0-9]/.test(mbPassword)) score++;

        if (score <= 1) return { level: 1, label: '약함', color: 'bg-destructive' };
        if (score <= 3) return { level: 2, label: '보통', color: 'bg-yellow-500' };
        return { level: 3, label: '강함', color: 'bg-green-500' };
    });

    const passwordValid = $derived(mbPassword.length >= 4);
    const passwordMatch = $derived(
        mbPassword.length > 0 && mbPasswordConfirm.length > 0 && mbPassword === mbPasswordConfirm
    );
    const passwordMismatch = $derived(
        mbPasswordConfirm.length > 0 && mbPassword !== mbPasswordConfirm
    );

    const canSubmit = $derived(
        idValidation === 'valid' &&
            passwordValid &&
            passwordMatch &&
            mbName.trim().length > 0 &&
            nickValidation === 'valid' &&
            emailValidation === 'valid' &&
            !isSubmitting
    );

    // --- Debounced duplicate checks ---

    async function checkDuplicate(
        type: 'id' | 'nick' | 'email',
        value: string
    ): Promise<{ available: boolean; message: string }> {
        const endpoints: Record<string, string> = {
            id: `/api/v1/auth/check-id?id=${encodeURIComponent(value)}`,
            nick: `/api/v1/auth/check-nick?nick=${encodeURIComponent(value)}`,
            email: `/api/v1/auth/check-email?email=${encodeURIComponent(value)}`
        };
        try {
            const res = await fetch(endpoints[type]);
            const json = await res.json();
            return json.data;
        } catch {
            return { available: false, message: '서버 연결에 실패했습니다.' };
        }
    }

    $effect(() => {
        if (idTimer) clearTimeout(idTimer);
        const val = mbId.trim();
        if (!val) {
            idValidation = 'idle';
            idMessage = '';
            return;
        }
        if (!idPattern.test(val)) {
            idValidation = 'invalid';
            idMessage = '3~20자의 영문, 숫자, 밑줄(_)만 사용 가능합니다.';
            return;
        }
        idValidation = 'checking';
        idMessage = '';
        idTimer = setTimeout(async () => {
            const result = await checkDuplicate('id', val);
            if (mbId.trim() === val) {
                idValidation = result.available ? 'valid' : 'invalid';
                idMessage = result.message;
            }
        }, 500);
    });

    $effect(() => {
        if (nickTimer) clearTimeout(nickTimer);
        const val = mbNick.trim();
        if (!val) {
            nickValidation = 'idle';
            nickMessage = '';
            return;
        }
        if (!nickPattern.test(val)) {
            nickValidation = 'invalid';
            nickMessage = '2~20자의 한글, 영문, 숫자, 점(.), 밑줄(_)만 사용 가능합니다.';
            return;
        }
        nickValidation = 'checking';
        nickMessage = '';
        nickTimer = setTimeout(async () => {
            const result = await checkDuplicate('nick', val);
            if (mbNick.trim() === val) {
                nickValidation = result.available ? 'valid' : 'invalid';
                nickMessage = result.message;
            }
        }, 500);
    });

    $effect(() => {
        if (emailTimer) clearTimeout(emailTimer);
        const val = mbEmail.trim();
        if (!val) {
            emailValidation = 'idle';
            emailMessage = '';
            return;
        }
        if (!emailPattern.test(val)) {
            emailValidation = 'invalid';
            emailMessage = '올바른 이메일 형식을 입력해주세요.';
            return;
        }
        emailValidation = 'checking';
        emailMessage = '';
        emailTimer = setTimeout(async () => {
            const result = await checkDuplicate('email', val);
            if (mbEmail.trim() === val) {
                emailValidation = result.available ? 'valid' : 'invalid';
                emailMessage = result.message;
            }
        }, 500);
    });

    // --- Turnstile ---

    onMount(() => {
        if (PUBLIC_TURNSTILE_SITE_KEY && turnstileRef && window.turnstile) {
            turnstileWidgetId = window.turnstile.render(turnstileRef, {
                sitekey: PUBLIC_TURNSTILE_SITE_KEY,
                theme: 'auto',
                retry: 'auto',
                'retry-interval': 5000,
                'error-callback': () => {
                    setTimeout(() => {
                        if (turnstileWidgetId !== undefined && window.turnstile) {
                            window.turnstile.reset(turnstileWidgetId);
                        }
                    }, 3000);
                    return true;
                }
            });
        }
    });

    // --- 실명인증 팝업 ---

    function openCertPopup() {
        const width = 500;
        const height = 620;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        window.open(
            '/cert/inicis?pageType=register',
            'sa_popup',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );
    }

    // postMessage 수신 (실명인증 팝업 결과)
    function handleCertMessage(event: MessageEvent) {
        if (event.data?.type === 'cert_result' && event.data.data?.success) {
            const d = event.data.data;
            certCompleted = true;
            certName = d.name || '';
            certPhone = d.phone || '';
            certAdult = d.adult || false;
            // 인증된 이름을 폼에 반영
            if (certName) mbName = certName;
        }
    }

    onMount(() => {
        window.addEventListener('message', handleCertMessage);
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('message', handleCertMessage);
        }
    });

    // --- Actions ---

    function goToNextStep() {
        currentStep++;
    }

    function goToPrevStep() {
        currentStep--;
    }

    async function handleSubmit() {
        if (!canSubmit) return;

        // 실명인증 필수인데 안 했으면 차단
        if (certRequired && !certCompleted) {
            submitError = '회원가입을 위해서는 본인확인을 해주셔야 합니다.';
            return;
        }

        isSubmitting = true;
        submitError = '';

        try {
            const body: Record<string, unknown> = {
                username: mbId.trim(),
                password: mbPassword,
                password_confirm: mbPasswordConfirm,
                name: mbName.trim(),
                nickname: mbNick.trim(),
                email: mbEmail.trim(),
                agree_terms: agreeTerms,
                agree_privacy: agreePrivacy
            };

            const res = await fetch('/api/v1/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                submitError = json.error?.message || json.message || '회원가입에 실패했습니다.';
                isSubmitting = false;
                return;
            }

            // 가입 완료
            currentStep = completeStep;
            isSubmitting = false;

            // 자동 리다이렉트 카운트다운
            const interval = setInterval(() => {
                redirectCountdown--;
                if (redirectCountdown <= 0) {
                    clearInterval(interval);
                    goto('/');
                }
            }, 1000);
        } catch {
            submitError = '서버와의 통신에 실패했습니다. 잠시 후 다시 시도해주세요.';
            isSubmitting = false;
        }
    }

    // Validation icon helper
    function validationIcon(state: ValidationState): {
        show: boolean;
        type: 'check' | 'x' | 'loading';
    } {
        if (state === 'checking') return { show: true, type: 'loading' };
        if (state === 'valid') return { show: true, type: 'check' };
        if (state === 'invalid') return { show: true, type: 'x' };
        return { show: false, type: 'check' };
    }
</script>

<svelte:head>
    <title>회원가입 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">회원가입</CardTitle>
            <CardDescription>
                {getStepLabel(currentStep)}
            </CardDescription>

            <!-- Step indicator -->
            <div class="mt-4 flex items-center justify-center gap-2">
                {#each Array.from({ length: totalSteps }, (_, i) => i + 1) as step}
                    <div
                        class="h-2 rounded-full transition-all duration-300 {step === currentStep
                            ? 'bg-primary w-8'
                            : step < currentStep
                              ? 'bg-primary/60 w-6'
                              : 'bg-muted w-6'}"
                    ></div>
                {/each}
            </div>
        </CardHeader>

        <CardContent>
            <!-- Step 1: 약관 동의 -->
            {#if currentStep === 1}
                <div class="space-y-6">
                    <div class="space-y-4">
                        <div class="flex items-start gap-3">
                            <Checkbox id="agree_terms" bind:checked={agreeTerms} />
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
                            <Checkbox id="agree_privacy" bind:checked={agreePrivacy} />
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

                    <Button class="w-full" disabled={!canProceedStep1} onclick={goToNextStep}>
                        다음
                    </Button>
                </div>

                <!-- Step 2: 실명인증 (certEnabled일 때만) -->
            {:else if certEnabled && currentStep === 2}
                <div class="space-y-6">
                    {#if certCompleted}
                        <!-- 인증 완료 상태 -->
                        <div
                            class="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950"
                        >
                            <div class="flex items-center gap-3">
                                <div
                                    class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
                                >
                                    <ShieldCheck
                                        class="h-5 w-5 text-green-600 dark:text-green-400"
                                    />
                                </div>
                                <div>
                                    <p class="font-medium text-green-800 dark:text-green-200">
                                        본인인증 완료
                                    </p>
                                    <p class="text-sm text-green-600 dark:text-green-400">
                                        {certName}
                                        {#if certPhone}
                                            ({certPhone})
                                        {/if}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="flex gap-3">
                            <Button variant="outline" class="flex-1" onclick={goToPrevStep}>
                                이전
                            </Button>
                            <Button class="flex-1" onclick={goToNextStep}>다음</Button>
                        </div>
                    {:else}
                        <!-- 인증 전 상태 -->
                        <div class="space-y-4 text-center">
                            <div
                                class="bg-muted/50 mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                            >
                                <ShieldCheck class="text-muted-foreground h-8 w-8" />
                            </div>
                            <div class="space-y-2">
                                <p class="text-sm">
                                    {#if certRequired}
                                        회원가입을 위해 <strong>본인인증</strong>이 필요합니다.
                                    {:else}
                                        <strong>본인인증</strong>을 진행할 수 있습니다.
                                    {/if}
                                </p>
                                <p class="text-muted-foreground text-xs">
                                    KG이니시스 간편인증으로 본인확인을 진행합니다.
                                </p>
                            </div>

                            <Button class="w-full" onclick={openCertPopup}>
                                <ShieldCheck class="mr-2 h-4 w-4" />
                                간편인증 하기
                            </Button>
                        </div>

                        <div class="flex gap-3">
                            <Button variant="outline" class="flex-1" onclick={goToPrevStep}>
                                이전
                            </Button>
                            {#if !certRequired}
                                <Button variant="ghost" class="flex-1" onclick={goToNextStep}>
                                    건너뛰기
                                </Button>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Step (form): 가입 정보 입력 -->
            {:else if currentStep === formStep}
                <div class="space-y-5">
                    <!-- Error message -->
                    {#if submitError}
                        <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                            {submitError}
                        </div>
                    {/if}

                    <!-- Username -->
                    <div class="space-y-2">
                        <Label for="mb_id">아이디 <span class="text-destructive">*</span></Label>
                        <div class="relative">
                            <Input
                                id="mb_id"
                                type="text"
                                placeholder="영문, 숫자, 밑줄 3~20자"
                                bind:value={mbId}
                                maxlength={20}
                                disabled={isSubmitting}
                                autocomplete="username"
                            />
                            {#if validationIcon(idValidation).show}
                                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                                    {#if validationIcon(idValidation).type === 'loading'}
                                        <Loader2
                                            class="text-muted-foreground h-4 w-4 animate-spin"
                                        />
                                    {:else if validationIcon(idValidation).type === 'check'}
                                        <Check class="h-4 w-4 text-green-500" />
                                    {:else}
                                        <X class="text-destructive h-4 w-4" />
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        {#if idMessage}
                            <p
                                class="text-xs {idValidation === 'valid'
                                    ? 'text-green-600'
                                    : 'text-destructive'}"
                            >
                                {idMessage}
                            </p>
                        {/if}
                    </div>

                    <!-- Password -->
                    <div class="space-y-2">
                        <Label for="mb_password"
                            >비밀번호 <span class="text-destructive">*</span></Label
                        >
                        <div class="relative">
                            <Input
                                id="mb_password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="4자 이상"
                                bind:value={mbPassword}
                                disabled={isSubmitting}
                                autocomplete="new-password"
                            />
                            <button
                                type="button"
                                class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                                onclick={() => (showPassword = !showPassword)}
                                tabindex={-1}
                            >
                                {#if showPassword}
                                    <EyeOff class="h-4 w-4" />
                                {:else}
                                    <Eye class="h-4 w-4" />
                                {/if}
                            </button>
                        </div>
                        {#if mbPassword.length > 0}
                            <div class="space-y-1">
                                <div class="flex gap-1">
                                    {#each [1, 2, 3] as level}
                                        <div
                                            class="h-1 flex-1 rounded-full transition-all duration-300 {passwordStrength.level >=
                                            level
                                                ? passwordStrength.color
                                                : 'bg-muted'}"
                                        ></div>
                                    {/each}
                                </div>
                                <p
                                    class="text-xs {passwordStrength.level === 0
                                        ? 'text-destructive'
                                        : passwordStrength.level <= 1
                                          ? 'text-destructive'
                                          : passwordStrength.level === 2
                                            ? 'text-yellow-600'
                                            : 'text-green-600'}"
                                >
                                    {passwordStrength.label}
                                </p>
                            </div>
                        {/if}
                    </div>

                    <!-- Password Confirm -->
                    <div class="space-y-2">
                        <Label for="mb_password_confirm"
                            >비밀번호 확인 <span class="text-destructive">*</span></Label
                        >
                        <div class="relative">
                            <Input
                                id="mb_password_confirm"
                                type={showPasswordConfirm ? 'text' : 'password'}
                                placeholder="비밀번호를 다시 입력하세요"
                                bind:value={mbPasswordConfirm}
                                disabled={isSubmitting}
                                autocomplete="new-password"
                            />
                            <button
                                type="button"
                                class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                                onclick={() => (showPasswordConfirm = !showPasswordConfirm)}
                                tabindex={-1}
                            >
                                {#if showPasswordConfirm}
                                    <EyeOff class="h-4 w-4" />
                                {:else}
                                    <Eye class="h-4 w-4" />
                                {/if}
                            </button>
                        </div>
                        {#if passwordMatch}
                            <p class="flex items-center gap-1 text-xs text-green-600">
                                <Check class="h-3 w-3" />
                                비밀번호가 일치합니다
                            </p>
                        {:else if passwordMismatch}
                            <p class="text-destructive flex items-center gap-1 text-xs">
                                <X class="h-3 w-3" />
                                비밀번호가 일치하지 않습니다
                            </p>
                        {/if}
                    </div>

                    <Separator />

                    <!-- Name -->
                    <div class="space-y-2">
                        <Label for="mb_name">이름 <span class="text-destructive">*</span></Label>
                        <Input
                            id="mb_name"
                            type="text"
                            placeholder="이름을 입력하세요"
                            bind:value={mbName}
                            disabled={isSubmitting || (certCompleted && !!certName)}
                            autocomplete="name"
                        />
                        {#if certCompleted && certName}
                            <p class="flex items-center gap-1 text-xs text-green-600">
                                <ShieldCheck class="h-3 w-3" />
                                본인인증으로 확인된 이름입니다
                            </p>
                        {/if}
                    </div>

                    <!-- Nickname -->
                    <div class="space-y-2">
                        <Label for="mb_nick">닉네임 <span class="text-destructive">*</span></Label>
                        <div class="relative">
                            <Input
                                id="mb_nick"
                                type="text"
                                placeholder="한글, 영문, 숫자 2~20자"
                                bind:value={mbNick}
                                maxlength={20}
                                disabled={isSubmitting}
                            />
                            {#if validationIcon(nickValidation).show}
                                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                                    {#if validationIcon(nickValidation).type === 'loading'}
                                        <Loader2
                                            class="text-muted-foreground h-4 w-4 animate-spin"
                                        />
                                    {:else if validationIcon(nickValidation).type === 'check'}
                                        <Check class="h-4 w-4 text-green-500" />
                                    {:else}
                                        <X class="text-destructive h-4 w-4" />
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        {#if nickMessage}
                            <p
                                class="text-xs {nickValidation === 'valid'
                                    ? 'text-green-600'
                                    : 'text-destructive'}"
                            >
                                {nickMessage}
                            </p>
                        {/if}
                    </div>

                    <!-- Email -->
                    <div class="space-y-2">
                        <Label for="mb_email">이메일 <span class="text-destructive">*</span></Label>
                        <div class="relative">
                            <Input
                                id="mb_email"
                                type="email"
                                placeholder="example@email.com"
                                bind:value={mbEmail}
                                disabled={isSubmitting}
                                autocomplete="email"
                            />
                            {#if validationIcon(emailValidation).show}
                                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                                    {#if validationIcon(emailValidation).type === 'loading'}
                                        <Loader2
                                            class="text-muted-foreground h-4 w-4 animate-spin"
                                        />
                                    {:else if validationIcon(emailValidation).type === 'check'}
                                        <Check class="h-4 w-4 text-green-500" />
                                    {:else}
                                        <X class="text-destructive h-4 w-4" />
                                    {/if}
                                </div>
                            {/if}
                        </div>
                        {#if emailMessage}
                            <p
                                class="text-xs {emailValidation === 'valid'
                                    ? 'text-green-600'
                                    : 'text-destructive'}"
                            >
                                {emailMessage}
                            </p>
                        {/if}
                    </div>

                    <!-- Turnstile CAPTCHA -->
                    {#if PUBLIC_TURNSTILE_SITE_KEY}
                        <div bind:this={turnstileRef} class="flex justify-center"></div>
                    {/if}

                    <!-- Action buttons -->
                    <div class="flex gap-3">
                        <Button
                            variant="outline"
                            class="flex-1"
                            onclick={goToPrevStep}
                            disabled={isSubmitting}
                        >
                            이전
                        </Button>
                        <Button class="flex-1" disabled={!canSubmit} onclick={handleSubmit}>
                            {#if isSubmitting}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                가입 중...
                            {:else}
                                <UserPlus class="mr-2 h-4 w-4" />
                                가입하기
                            {/if}
                        </Button>
                    </div>
                </div>

                <!-- Complete step -->
            {:else if currentStep === completeStep}
                <div class="space-y-6 py-4 text-center">
                    <div
                        class="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                    >
                        <Check class="text-primary h-8 w-8" />
                    </div>
                    <div class="space-y-2">
                        <h3 class="text-lg font-semibold">회원가입이 완료되었습니다!</h3>
                        <p class="text-muted-foreground text-sm">
                            환영합니다. {redirectCountdown}초 후 홈으로 이동합니다.
                        </p>
                    </div>
                    <Button class="w-full" onclick={() => goto('/')}>홈으로 이동</Button>
                </div>
            {/if}

            <!-- Login link (complete 전 단계만) -->
            {#if currentStep < completeStep}
                <div class="mt-6 text-center text-sm">
                    <span class="text-muted-foreground">이미 계정이 있으신가요?</span>
                    <a href="/login" class="text-primary ml-1 hover:underline">로그인</a>
                </div>
            {/if}
        </CardContent>
    </Card>
</div>
