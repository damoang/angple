<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import type { CheckoutData } from '$plugins/ad-free/server/loaders';
    import PaymentDemoModal from './PaymentDemoModal.svelte';

    interface ExtendedCheckoutData extends CheckoutData {
        isGuest: boolean;
        prefill: { email: string; nickname: string };
    }

    let { data }: { data: ExtendedCheckoutData } = $props();

    let selectedPlan = $state<'monthly' | 'half_yearly'>(data.initialPlan);
    let selectedProvider = $state<'naverpay' | 'paypal'>('naverpay');
    let submitting = $state(false);
    let stubMessage = $state<string | null>(null);
    let demoOpen = $state(false);

    // 비회원 폼 state
    let email = $state(data.prefill.email);
    let nickname = $state(data.prefill.nickname);
    let agreements = $state<Record<string, boolean>>({});

    const currentPlan = $derived(data.plans.find((p) => p.id === selectedPlan) ?? data.plans[0]);
    const allRequiredAgreed = $derived(
        data.guestPolicy.requiredAgreements
            .filter((a) => a.required)
            .every((a) => agreements[a.id] === true)
    );
    const emailValid = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    const nicknameValid = $derived(nickname.trim().length >= 2 && nickname.trim().length <= 20);
    const guestFormValid = $derived(
        !data.isGuest || (emailValid && nicknameValid && allRequiredAgreed)
    );

    function formatPrice(amount: number, currency: 'KRW' | 'USD'): string {
        if (currency === 'KRW') return `₩${amount.toLocaleString('ko-KR')}`;
        return `$${(amount / 100).toFixed(2)}`;
    }

    function toggleAgreement(id: string, checked: boolean) {
        agreements = { ...agreements, [id]: checked };
    }

    function toggleAllAgreements(checked: boolean) {
        const next: Record<string, boolean> = {};
        for (const a of data.guestPolicy.requiredAgreements) next[a.id] = checked;
        agreements = next;
    }

    // 1단계: 유효성 검증 + 데모 모달 표시 (가맹 통과 전/후 동일)
    function handleSubmit() {
        if (submitting) return;
        if (!guestFormValid) {
            stubMessage = '비회원 결제를 위해 이메일, 닉네임, 약관 동의를 모두 완료해주세요.';
            return;
        }
        stubMessage = null;
        demoOpen = true;
    }

    // 2단계: 데모 모달 "결제 진행" 클릭 → 실 API 호출 (가맹 미통과 시 stub, 통과 시 PG redirect)
    async function handleDemoConfirm() {
        demoOpen = false;
        submitting = true;
        try {
            const endpoint = data.isGuest
                ? '/api/plugins/ad-free/guest-checkout'
                : '/api/plugins/payment/checkout/start';
            const body = data.isGuest
                ? {
                      plan: `ad_free_${selectedPlan}`,
                      provider: selectedProvider,
                      email,
                      nickname: nickname.trim(),
                      agreements
                  }
                : {
                      plan: `ad_free_${selectedPlan}`,
                      provider: selectedProvider
                  };
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                stubMessage =
                    json?.message ?? `결제 시작 실패 (${res.status}). 잠시 후 다시 시도해주세요.`;
                return;
            }
            if (json?.redirect_url) {
                window.location.href = json.redirect_url;
            } else if (json?.message) {
                stubMessage = json.message;
            } else {
                stubMessage = '결제창을 여는 중입니다…';
            }
        } catch (err) {
            stubMessage = '결제 시작 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
            console.error('[ad-free checkout]', err);
        } finally {
            submitting = false;
        }
    }

    function handleDemoCancel() {
        demoOpen = false;
    }
</script>

<svelte:head>
    <title>구독 결제 | {data.productName}</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<div class="ad-free-checkout mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <header class="text-center">
        <p class="text-muted-foreground text-sm">광고 제거 멤버십</p>
        <h1 class="mt-2 text-3xl font-bold sm:text-4xl">{data.productName} 구독</h1>
        <p class="text-muted-foreground mt-3 text-sm">
            {data.trialDays}일 무료 체험 후 자동 결제됩니다. 체험 중 언제든 해지 가능합니다.
        </p>
        {#if data.isGuest}
            <p class="text-muted-foreground mt-2 text-xs">
                <strong>비회원도 결제 가능</strong> — 결제 완료 시 자동으로 회원 가입되며, 입력하신
                이메일로 비밀번호 안내가 전송됩니다.
                <a href="/login?redirect=/ad-free/checkout" class="text-primary underline">
                    이미 회원이신가요?
                </a>
            </p>
        {/if}
    </header>

    <section class="mt-10">
        <h2 class="text-base font-semibold">요금제 선택</h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
            {#each data.plans as plan (plan.id)}
                <button
                    type="button"
                    class="bg-card hover:border-primary rounded-xl border p-5 text-left transition"
                    class:border-primary={selectedPlan === plan.id}
                    class:ring-primary={selectedPlan === plan.id}
                    class:ring-2={selectedPlan === plan.id}
                    onclick={() => (selectedPlan = plan.id)}
                >
                    <div class="flex items-baseline justify-between">
                        <span class="font-semibold">{plan.label}</span>
                        {#if plan.badge}
                            <span
                                class="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium"
                            >
                                {plan.badge}
                            </span>
                        {/if}
                    </div>
                    <p class="mt-2">
                        <span class="text-2xl font-bold"
                            >{formatPrice(plan.price, data.currency)}</span
                        >
                        <span class="text-muted-foreground"> / {plan.period}</span>
                    </p>
                </button>
            {/each}
        </div>
    </section>

    <section class="mt-8">
        <h2 class="text-base font-semibold">결제 수단</h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
            {#each data.providers as provider (provider.id)}
                <button
                    type="button"
                    class="bg-card hover:border-primary rounded-xl border p-5 text-left transition"
                    class:border-primary={selectedProvider === provider.id}
                    class:ring-primary={selectedProvider === provider.id}
                    class:ring-2={selectedProvider === provider.id}
                    onclick={() => (selectedProvider = provider.id)}
                >
                    <p class="font-semibold">{provider.label}</p>
                    {#if provider.description}
                        <p class="text-muted-foreground mt-1 text-xs">{provider.description}</p>
                    {/if}
                </button>
            {/each}
        </div>
    </section>

    {#if data.isGuest}
        <section class="mt-8">
            <h2 class="text-base font-semibold">구매자 정보 (비회원)</h2>
            <div class="mt-3 space-y-3">
                <label class="block">
                    <span class="text-sm font-medium">이메일</span>
                    <input
                        type="email"
                        bind:value={email}
                        placeholder="you@example.com"
                        autocomplete="email"
                        class="bg-card focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                    {#if email && !emailValid}
                        <span class="mt-1 block text-xs text-red-600"
                            >올바른 이메일 형식이 아닙니다</span
                        >
                    {/if}
                    <span class="text-muted-foreground mt-1 block text-xs">
                        결제 영수증 + 자동 회원 가입 안내 발송에 사용됩니다.
                    </span>
                </label>
                <label class="block">
                    <span class="text-sm font-medium">닉네임 (2~20자)</span>
                    <input
                        type="text"
                        bind:value={nickname}
                        placeholder="홍길동"
                        autocomplete="nickname"
                        maxlength="20"
                        class="bg-card focus:border-primary focus:ring-primary/20 mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                    {#if nickname && !nicknameValid}
                        <span class="mt-1 block text-xs text-red-600">2~20자로 입력해주세요</span>
                    {/if}
                </label>
            </div>
        </section>

        <section class="mt-8">
            <h2 class="text-base font-semibold">약관 동의</h2>
            <div class="mt-3 space-y-2 rounded-lg border p-4">
                <label class="flex cursor-pointer items-center gap-2 border-b pb-2">
                    <input
                        type="checkbox"
                        checked={data.guestPolicy.requiredAgreements.every((a) => agreements[a.id])}
                        onchange={(e) =>
                            toggleAllAgreements((e.target as HTMLInputElement).checked)}
                        class="h-4 w-4"
                    />
                    <span class="text-sm font-semibold">모두 동의</span>
                </label>
                {#each data.guestPolicy.requiredAgreements as agreement (agreement.id)}
                    <label class="flex cursor-pointer items-start gap-2">
                        <input
                            type="checkbox"
                            checked={agreements[agreement.id] === true}
                            onchange={(e) =>
                                toggleAgreement(
                                    agreement.id,
                                    (e.target as HTMLInputElement).checked
                                )}
                            class="mt-0.5 h-4 w-4"
                        />
                        <span class="text-sm">
                            {#if agreement.required}<span class="text-red-600">(필수)</span
                                >{:else}<span class="text-muted-foreground">(선택)</span>{/if}
                            {agreement.label}
                        </span>
                    </label>
                {/each}
            </div>
        </section>
    {/if}

    <Card class="mt-10">
        <CardHeader>
            <CardTitle>주문 요약</CardTitle>
            <CardDescription>
                {data.productName} · {currentPlan.label}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                    <dt class="text-muted-foreground">요금</dt>
                    <dd class="font-medium">
                        {formatPrice(currentPlan.price, data.currency)} / {currentPlan.period}
                    </dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-muted-foreground">무료 체험</dt>
                    <dd>{data.trialDays}일</dd>
                </div>
                <div class="flex justify-between">
                    <dt class="text-muted-foreground">결제 수단</dt>
                    <dd>{data.providers.find((p) => p.id === selectedProvider)?.label}</dd>
                </div>
                {#if data.isGuest}
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">구매자</dt>
                        <dd class="text-xs">
                            {email || '(이메일 미입력)'}
                        </dd>
                    </div>
                {/if}
            </dl>

            {#if !data.isMerchantApproved}
                <p
                    class="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200"
                >
                    ⚠ 가맹점 심사 진행 중입니다. 결제 버튼을 누르셔도 실제 결제는 일어나지 않으며,
                    심사 통과 후 안내드릴 예정입니다.
                </p>
            {/if}

            <Button
                class="mt-5 w-full"
                size="lg"
                disabled={submitting || !guestFormValid}
                onclick={handleSubmit}
            >
                {submitting
                    ? '진행 중…'
                    : `${formatPrice(currentPlan.price, data.currency)} 결제하기`}
            </Button>

            {#if stubMessage}
                <p
                    class="bg-muted text-muted-foreground mt-4 rounded-lg p-3 text-sm"
                    role="status"
                    aria-live="polite"
                >
                    {stubMessage}
                </p>
            {/if}

            <p class="text-muted-foreground mt-4 text-center text-xs">
                결제를 진행하시면
                <a href="/ad-free/refund-policy" class="underline">환불 정책</a>
                에 동의하는 것으로 간주됩니다.
            </p>
        </CardContent>
    </Card>
</div>

<PaymentDemoModal
    open={demoOpen}
    productName={data.productName}
    planLabel={currentPlan.label}
    amountText={formatPrice(currentPlan.price, data.currency)}
    period={currentPlan.period}
    provider={selectedProvider}
    providerLabel={data.providers.find((p) => p.id === selectedProvider)?.label ?? selectedProvider}
    buyerEmail={data.isGuest ? email : data.prefill.email}
    supportEmail={data.supportEmail}
    onConfirm={handleDemoConfirm}
    onCancel={handleDemoCancel}
/>
