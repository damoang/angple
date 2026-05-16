<script lang="ts">
    import { Button } from '$lib/components/ui/button';

    interface Props {
        open: boolean;
        productName: string;
        planLabel: string;
        amountText: string;
        period: string;
        provider: 'naverpay' | 'paypal';
        providerLabel: string;
        buyerEmail?: string;
        supportEmail: string;
        onConfirm: () => void;
        onCancel: () => void;
    }

    let {
        open,
        productName,
        planLabel,
        amountText,
        period,
        provider,
        providerLabel,
        buyerEmail,
        supportEmail,
        onConfirm,
        onCancel
    }: Props = $props();

    // 네이버페이/PayPal 의 대표 컬러로 결제창 분위기 시뮬레이션
    const accent = $derived(provider === 'naverpay' ? '#03c75a' : '#0070ba');

    function handleBackdrop(e: MouseEvent) {
        if (e.target === e.currentTarget) onCancel();
    }
</script>

{#if open}
    <div
        class="payment-demo-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onclick={handleBackdrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-demo-title"
        tabindex="-1"
        onkeydown={(e) => e.key === 'Escape' && onCancel()}
    >
        <div
            class="bg-card relative w-full max-w-md overflow-hidden rounded-2xl shadow-xl"
            role="document"
        >
            <!-- 결제창 헤더 (provider 컬러) -->
            <header
                class="flex items-center justify-between px-5 py-4"
                style:background-color={accent}
            >
                <div class="flex items-center gap-2 text-white">
                    <span class="text-lg font-bold">{providerLabel}</span>
                    <span class="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                        DEMO
                    </span>
                </div>
                <button
                    type="button"
                    onclick={onCancel}
                    class="text-white/80 hover:text-white"
                    aria-label="결제 취소"
                >
                    ✕
                </button>
            </header>

            <!-- 상단 안내 -->
            <div
                class="border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-800 dark:bg-amber-900/20"
            >
                <p class="text-xs leading-snug text-amber-900 dark:text-amber-200">
                    ⚠️ <strong>가맹점 심사 진행 중</strong>입니다. 이 화면은 결제 흐름 시각화이며
                    실제 결제는 일어나지 않습니다.
                </p>
            </div>

            <!-- 결제 정보 -->
            <div class="p-5">
                <h2 id="payment-demo-title" class="text-lg font-bold">결제 정보 확인</h2>
                <dl class="mt-4 space-y-2 text-sm">
                    <div class="flex justify-between border-b pb-2">
                        <dt class="text-muted-foreground">상품명</dt>
                        <dd class="text-right font-medium">{productName}</dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                        <dt class="text-muted-foreground">요금제</dt>
                        <dd class="text-right">{planLabel}</dd>
                    </div>
                    <div class="flex items-baseline justify-between border-b pb-2">
                        <dt class="text-muted-foreground">결제 금액</dt>
                        <dd class="text-right">
                            <span class="text-xl font-bold" style:color={accent}>{amountText}</span>
                            <span class="text-muted-foreground text-xs"> / {period}</span>
                        </dd>
                    </div>
                    <div class="flex justify-between border-b pb-2">
                        <dt class="text-muted-foreground">결제 수단</dt>
                        <dd>{providerLabel} 정기결제</dd>
                    </div>
                    {#if buyerEmail}
                        <div class="flex justify-between">
                            <dt class="text-muted-foreground">구매자</dt>
                            <dd class="text-xs">{buyerEmail}</dd>
                        </div>
                    {/if}
                </dl>

                <!-- 약관 재확인 -->
                <p class="text-muted-foreground mt-4 text-xs leading-relaxed">
                    다음 결제일에 동일 금액이 등록된 결제수단으로 자동 청구됩니다. 해지는 마이페이지
                    또는 <a href="mailto:{supportEmail}" class="underline">{supportEmail}</a> 에서
                    가능하며, 환불 정책은
                    <a href="/ad-free/refund-policy" class="underline">여기</a>를 참고하세요.
                </p>

                <!-- 액션 -->
                <div class="mt-5 flex gap-2">
                    <Button variant="outline" class="flex-1" onclick={onCancel}>취소</Button>
                    <button
                        type="button"
                        onclick={onConfirm}
                        class="ring-offset-background focus-visible:ring-ring inline-flex h-10 flex-1 items-center justify-center rounded-md px-4 text-sm font-medium text-white shadow transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                        style:background-color={accent}
                    >
                        {amountText} 결제 진행
                    </button>
                </div>

                <!-- 보조 안내 -->
                <p class="text-muted-foreground mt-4 text-center text-[10px]">
                    이 데모는 가맹점 심사 통과 후 실제 PG 결제창으로 자동 전환됩니다.
                </p>
            </div>
        </div>
    </div>
{/if}

<style>
    .payment-demo-backdrop {
        animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>
