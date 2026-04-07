<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button/index.js';
    import CreditCard from '@lucide/svelte/icons/credit-card';

    interface Props {
        clientKey: string;
        orderId: string;
        orderName: string;
        amount: number;
        customerName: string;
        customerEmail?: string;
        successUrl: string;
        failUrl: string;
        onError?: (error: Error) => void;
    }

    let {
        clientKey,
        orderId,
        orderName,
        amount,
        customerName,
        customerEmail = '',
        successUrl,
        failUrl,
        onError
    }: Props = $props();

    let isReady = $state(false);
    let isProcessing = $state(false);
    let sdkError = $state('');

    onMount(() => {
        if (!browser) return;
        const script = document.createElement('script');
        script.src = 'https://js.tosspayments.com/v2/standard';
        script.onload = () => {
            isReady = true;
        };
        script.onerror = () => {
            sdkError = '결제 모듈을 불러올 수 없습니다. 페이지를 새로고침해 주세요.';
        };
        document.head.appendChild(script);
        return () => {
            document.head.removeChild(script);
        };
    });

    async function requestPayment(): Promise<void> {
        if (!isReady || isProcessing) return;
        isProcessing = true;
        sdkError = '';

        try {
            // @ts-ignore — Toss SDK global
            const tossPayments = window.TossPayments(clientKey);
            const payment = tossPayments.payment({ customerKey: customerName });

            await payment.requestPayment({
                method: '카드',
                amount: { currency: 'KRW', value: amount },
                orderId,
                orderName,
                customerName,
                customerEmail: customerEmail || undefined,
                successUrl,
                failUrl
            });
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error('결제 요청 실패');
            sdkError = error.message;
            onError?.(error);
        } finally {
            isProcessing = false;
        }
    }
</script>

{#if sdkError}
    <div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {sdkError}
    </div>
{/if}

<Button class="w-full" size="lg" onclick={requestPayment} disabled={!isReady || isProcessing}>
    <CreditCard class="mr-2 h-5 w-5" />
    {#if !isReady}
        결제 모듈 로딩 중...
    {:else if isProcessing}
        결제 진행 중...
    {:else}
        {amount.toLocaleString()}원 결제하기
    {/if}
</Button>
