<script lang="ts">
    import { page } from '$app/stores';
    import TossPayment from '$lib/components/ui/commerce/toss-payment.svelte';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const order = $derived(data.order);
    const payment = $derived(data.payment);
    const hasError = $derived($page.url.searchParams.get('error'));
    const isPhysical = $derived(
        order?.items?.some((i: { product_type: string }) => i.product_type === 'physical')
    );

    // 배송 정보
    let shipName = $state('');
    let shipPhone = $state('');
    let shipAddress = $state('');
    let shipPostal = $state('');
    let shipMemo = $state('');
    let paymentError = $state('');
</script>

<svelte:head>
    <title>결제 - 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6">
    <button
        class="text-muted-foreground mb-6 flex items-center gap-1 text-sm hover:underline"
        onclick={() => history.back()}
    >
        <ArrowLeft class="h-4 w-4" />
        돌아가기
    </button>

    <h1 class="mb-6 text-2xl font-bold">결제</h1>

    {#if hasError}
        <div
            class="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
            <AlertTriangle class="h-4 w-4 shrink-0" />
            {hasError === 'cancelled'
                ? '결제가 취소되었습니다.'
                : '결제 처리 중 오류가 발생했습니다.'}
        </div>
    {/if}

    {#if paymentError}
        <div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {paymentError}
        </div>
    {/if}

    {#if !order || !payment}
        <div class="text-muted-foreground py-12 text-center">주문 정보를 불러올 수 없습니다.</div>
    {:else}
        <div class="space-y-6">
            <!-- 주문 요약 -->
            <div class="rounded-lg border p-4">
                <h2 class="mb-3 font-semibold">주문 요약</h2>
                <p class="text-muted-foreground text-sm">주문번호: {order.order_number}</p>
                <div class="mt-3 space-y-2">
                    {#each order.items || [] as item}
                        <div class="flex justify-between text-sm">
                            <span>{item.product_name} × {item.quantity}</span>
                            <span>{item.subtotal?.toLocaleString()}원</span>
                        </div>
                    {/each}
                </div>
                <div class="mt-3 flex justify-between border-t pt-3 text-lg font-bold">
                    <span>총 결제금액</span>
                    <span class="text-primary">{order.total?.toLocaleString()}원</span>
                </div>
            </div>

            <!-- 배송 정보 (물리 상품) -->
            {#if isPhysical}
                <div class="rounded-lg border p-4">
                    <h2 class="mb-3 font-semibold">배송 정보</h2>
                    <div class="space-y-3">
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="text-sm font-medium" for="name">받는 분</label>
                                <input
                                    id="name"
                                    bind:value={shipName}
                                    placeholder="이름"
                                    class="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label class="text-sm font-medium" for="phone">연락처</label>
                                <input
                                    id="phone"
                                    bind:value={shipPhone}
                                    placeholder="010-0000-0000"
                                    class="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="text-sm font-medium" for="postal">우편번호</label>
                            <input
                                id="postal"
                                bind:value={shipPostal}
                                placeholder="우편번호"
                                class="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label class="text-sm font-medium" for="addr">주소</label>
                            <input
                                id="addr"
                                bind:value={shipAddress}
                                placeholder="상세 주소"
                                class="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label class="text-sm font-medium" for="memo">배송 메모</label>
                            <input
                                id="memo"
                                bind:value={shipMemo}
                                placeholder="부재 시 문 앞에 놓아주세요"
                                class="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                            />
                        </div>
                    </div>
                </div>
            {/if}

            <!-- 결제 -->
            <TossPayment
                clientKey={payment.extra_data?.clientKey || payment.merchant_id}
                orderId={payment.pg_order_id}
                orderName={order.items?.[0]?.product_name || '상품'}
                amount={payment.amount}
                customerName={String(order.user_id)}
                successUrl="{$page.url.origin}/checkout/complete"
                failUrl="{$page.url.origin}/checkout/{order.id}?error=payment_failed"
                onError={(err) => {
                    if (!err.message.includes('USER_CANCEL') && !err.message.includes('취소')) {
                        paymentError = err.message;
                    }
                }}
            />
        </div>
    {/if}
</div>
