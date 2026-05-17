<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import type { LandingData } from '$plugins/ad-free/server/loaders';

    let { data }: { data: LandingData } = $props();

    function formatPrice(amount: number, currency: 'KRW' | 'USD'): string {
        if (currency === 'KRW') return `₩${amount.toLocaleString('ko-KR')}`;
        return `$${(amount / 100).toFixed(2)}`;
    }
</script>

<svelte:head>
    <title>{data.productName} | 광고 없이 깔끔한 경험</title>
    <meta
        name="description"
        content="{data.productName} — AdSense 광고 없이 콘텐츠에 집중하세요. {data.trialDays}일 무료 체험."
    />
</svelte:head>

<div class="ad-free-landing mx-auto max-w-5xl px-4 py-12 sm:py-20">
    <section class="text-center">
        <span
            class="bg-primary/10 text-primary inline-block rounded-full px-3 py-1 text-xs font-medium"
        >
            PC 전용 광고 제거 멤버십
        </span>
        <h1 class="mt-4 text-4xl font-bold sm:text-5xl">
            PC <span class="text-primary">광고 없이</span>, 더 편하게
        </h1>
        <p class="text-muted-foreground mt-3 text-xl sm:text-2xl">{data.productName}</p>
        <p class="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed">
            PC AdSense 광고만 제거합니다. <strong class="text-foreground">모바일 광고</strong>와
            <strong class="text-foreground">다모앙 자체 배너</strong>는 멤버십과 무관하게 그대로
            노출됩니다.
        </p>
        <div class="mt-8 flex justify-center gap-3">
            <Button size="lg" href="/ad-free/checkout">{data.trialDays}일 무료 체험 시작</Button>
        </div>
        <p class="text-muted-foreground mt-4 text-xs">언제든 해지 가능 · 약정 없음</p>
    </section>

    <!-- 정책 요약 박스 — 멤버십 적용 범위 명확화 -->
    <section
        class="border-primary/20 bg-primary/5 mt-12 rounded-2xl border p-6 sm:p-8"
        aria-label="멤버십 적용 범위"
    >
        <h2 class="text-center text-lg font-semibold sm:text-xl">멤버십 적용 범위</h2>
        <div class="mt-5 grid gap-4 sm:grid-cols-3">
            <div class="text-center">
                <div class="mb-2 text-3xl">🖥️</div>
                <div class="font-medium">PC AdSense</div>
                <div
                    class="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
                >
                    제거 ✓
                </div>
            </div>
            <div class="text-center">
                <div class="mb-2 text-3xl">📱</div>
                <div class="font-medium">모바일 AdSense</div>
                <div
                    class="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                >
                    유지
                </div>
            </div>
            <div class="text-center">
                <div class="mb-2 text-3xl">🎯</div>
                <div class="font-medium">다모앙 자체 배너</div>
                <div
                    class="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                >
                    유지
                </div>
            </div>
        </div>
    </section>

    <section class="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {#each data.benefits as benefit (benefit.title)}
            <div
                class="bg-card hover:border-primary/40 hover:shadow-primary/5 rounded-xl border p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
                <div class="text-3xl">{benefit.icon}</div>
                <h3 class="mt-3 font-semibold">{benefit.title}</h3>
                <p class="text-muted-foreground mt-1 text-sm">{benefit.desc}</p>
            </div>
        {/each}
    </section>

    <section class="mt-20">
        <h2 class="text-center text-2xl font-bold">합리적인 가격</h2>
        <div class="mt-8 grid gap-6 sm:grid-cols-2">
            {#each data.plans as plan (plan.id)}
                <Card class={plan.recommended ? 'border-primary ring-primary/20 ring-2' : ''}>
                    <CardHeader>
                        <CardTitle class="flex items-baseline justify-between">
                            <span>{plan.label}</span>
                            {#if plan.badge}
                                <span
                                    class="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium"
                                >
                                    {plan.badge}
                                </span>
                            {/if}
                        </CardTitle>
                        <CardDescription>
                            <span class="text-foreground text-3xl font-bold">
                                {formatPrice(plan.price, data.currency)}
                            </span>
                            <span class="text-muted-foreground"> / {plan.period}</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            class="w-full"
                            variant={plan.recommended ? 'default' : 'outline'}
                            href="/ad-free/checkout?plan={plan.id}"
                        >
                            {plan.recommended ? '시작하기 (추천)' : '시작하기'}
                        </Button>
                    </CardContent>
                </Card>
            {/each}
        </div>
    </section>

    <section class="mt-20">
        <h2 class="text-center text-2xl font-bold">자주 묻는 질문</h2>
        <div class="mx-auto mt-8 max-w-2xl space-y-4">
            {#each data.faqs as faq (faq.q)}
                <details class="bg-card rounded-lg border p-4">
                    <summary class="cursor-pointer font-medium">{faq.q}</summary>
                    <p class="text-muted-foreground mt-2 text-sm">{faq.a}</p>
                </details>
            {/each}
            <p class="text-muted-foreground text-center text-sm">
                추가 문의는
                <a href="mailto:{data.supportEmail}" class="underline">{data.supportEmail}</a>
                으로 보내주세요.
            </p>
            <p class="text-center text-sm">
                <a href="/ad-free/refund-policy" class="text-primary underline">환불 정책 보기</a>
            </p>
        </div>
    </section>
</div>
