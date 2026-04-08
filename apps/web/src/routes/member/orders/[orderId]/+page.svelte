<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import Package from '@lucide/svelte/icons/package';
    import Truck from '@lucide/svelte/icons/truck';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const order = $derived(data.order);
    const tracking = $derived(data.tracking);

    let cancelling = $state(false);

    const statusLabels: Record<string, string> = {
        pending: '결제 대기',
        paid: '결제 완료',
        processing: '처리 중',
        shipped: '배송 중',
        delivered: '배송 완료',
        completed: '구매 확정',
        cancelled: '취소됨',
        refunded: '환불됨'
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        paid: 'bg-blue-100 text-blue-800',
        processing: 'bg-indigo-100 text-indigo-800',
        shipped: 'bg-purple-100 text-purple-800',
        delivered: 'bg-green-100 text-green-800',
        completed: 'bg-green-200 text-green-900',
        cancelled: 'bg-red-100 text-red-800',
        refunded: 'bg-gray-100 text-gray-800'
    };

    async function handleCancel(): Promise<void> {
        if (cancelling || !confirm('주문을 취소하시겠습니까?')) return;
        cancelling = true;
        try {
            const res = await fetch(`/api/commerce/orders/${order.id}/cancel`, { method: 'POST' });
            if (res.ok) {
                window.location.reload();
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err.message || '주문 취소에 실패했습니다');
            }
        } finally {
            cancelling = false;
        }
    }
</script>

<svelte:head>
    <title>주문 상세 - 다모앙 상점</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6">
    <a
        href="/member/orders"
        class="text-muted-foreground mb-6 flex items-center gap-1 text-sm hover:underline"
    >
        <ArrowLeft class="h-4 w-4" />
        주문 내역으로
    </a>

    {#if !order}
        <div class="text-muted-foreground py-12 text-center">주문 정보를 찾을 수 없습니다.</div>
    {:else}
        <div class="space-y-6">
            <!-- 주문 헤더 -->
            <div class="flex items-center justify-between">
                <div>
                    <h1 class="text-xl font-bold">주문 상세</h1>
                    <p class="text-muted-foreground text-sm">주문번호: {order.order_number}</p>
                </div>
                <span
                    class="rounded-full px-3 py-1 text-xs font-semibold {statusColors[
                        order.status
                    ] || 'bg-gray-100 text-gray-800'}"
                >
                    {statusLabels[order.status] || order.status}
                </span>
            </div>

            <!-- 상품 목록 -->
            <div class="rounded-lg border p-4">
                <h2 class="mb-3 font-semibold">주문 상품</h2>
                <div class="space-y-3">
                    {#each order.items || [] as item}
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <Package class="text-muted-foreground h-5 w-5 shrink-0" />
                                <div>
                                    <p class="text-sm font-medium">{item.product_name}</p>
                                    <p class="text-muted-foreground text-xs">
                                        수량: {item.quantity}
                                    </p>
                                </div>
                            </div>
                            <span class="text-sm font-semibold"
                                >{Number(item.subtotal).toLocaleString()}원</span
                            >
                        </div>
                    {/each}
                </div>
                <div class="mt-4 flex justify-between border-t pt-3 text-lg font-bold">
                    <span>총 결제금액</span>
                    <span class="text-primary">{Number(order.total).toLocaleString()}원</span>
                </div>
            </div>

            <!-- 배송 추적 -->
            {#if tracking}
                <div class="rounded-lg border p-4">
                    <h2 class="mb-3 flex items-center gap-2 font-semibold">
                        <Truck class="h-5 w-5" />
                        배송 추적
                    </h2>
                    <div class="space-y-2 text-sm">
                        <p>택배사: {tracking.carrier_name || tracking.carrier}</p>
                        <p>운송장번호: {tracking.tracking_number}</p>
                        {#if tracking.status}
                            <p>상태: {tracking.status}</p>
                        {/if}
                    </div>
                </div>
            {/if}

            <!-- 주문 정보 -->
            <div class="rounded-lg border p-4">
                <h2 class="mb-3 font-semibold">주문 정보</h2>
                <div class="text-muted-foreground space-y-1 text-sm">
                    <p>주문일시: {new Date(order.created_at).toLocaleString('ko-KR')}</p>
                    {#if order.shipping_address}
                        <p>배송지: {order.shipping_address}</p>
                    {/if}
                </div>
            </div>

            <!-- 취소 버튼 (결제 대기/완료 상태에서만) -->
            {#if order.status === 'pending' || order.status === 'paid'}
                <Button
                    variant="destructive"
                    class="w-full"
                    onclick={handleCancel}
                    disabled={cancelling}
                >
                    {cancelling ? '취소 중...' : '주문 취소'}
                </Button>
            {/if}
        </div>
    {/if}
</div>
