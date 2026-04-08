<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import Package from '@lucide/svelte/icons/package';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const STATUS_LABELS: Record<string, string> = {
        pending: '결제 대기',
        paid: '결제 완료',
        processing: '처리 중',
        shipped: '배송 중',
        delivered: '배송 완료',
        completed: '완료',
        cancelled: '취소됨',
        refunded: '환불됨'
    };

    const STATUS_COLORS: Record<string, string> = {
        pending: 'text-yellow-600',
        paid: 'text-blue-600',
        processing: 'text-blue-600',
        shipped: 'text-purple-600',
        delivered: 'text-green-600',
        completed: 'text-green-600',
        cancelled: 'text-red-500',
        refunded: 'text-red-500'
    };
</script>

<svelte:head>
    <title>주문 내역 - 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6">
    <h1 class="mb-6 text-2xl font-bold">주문 내역</h1>

    {#if data.orders.length === 0}
        <div class="text-muted-foreground flex flex-col items-center py-16">
            <Package class="mb-4 h-16 w-16" />
            <p>주문 내역이 없습니다.</p>
            <Button variant="outline" class="mt-4" onclick={() => goto('/shop')}>
                상점 둘러보기
            </Button>
        </div>
    {:else}
        <div class="space-y-4">
            {#each data.orders as order}
                <a
                    href="/member/orders/{order.id}"
                    class="hover:bg-muted/50 block rounded-lg border p-4 transition-colors"
                >
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium">{order.order_number}</p>
                            <p class="text-muted-foreground text-xs">
                                {new Date(order.created_at).toLocaleDateString('ko-KR')}
                            </p>
                        </div>
                        <span class="text-sm font-medium {STATUS_COLORS[order.status] || ''}">
                            {STATUS_LABELS[order.status] || order.status}
                        </span>
                    </div>

                    {#if order.items?.length}
                        <div class="mt-3 space-y-1">
                            {#each order.items as item}
                                <div class="flex justify-between text-sm">
                                    <span>{item.product_name} × {item.quantity}</span>
                                    <span>{item.subtotal?.toLocaleString()}원</span>
                                </div>
                            {/each}
                        </div>
                    {/if}

                    <div class="mt-3 flex items-center justify-between border-t pt-3">
                        <span class="font-bold">{order.total?.toLocaleString()}원</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => goto(`/checkout/${order.id}`)}
                        >
                            상세보기
                        </Button>
                    </div>
                </a>
            {/each}
        </div>
    {/if}
</div>
