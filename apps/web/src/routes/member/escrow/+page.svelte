<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import Shield from '@lucide/svelte/icons/shield';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const transactions = $derived(data.transactions);

    const statusLabels: Record<string, string> = {
        pending: '결제 대기',
        paid: '결제 완료',
        shipped: '배송 중',
        confirmed: '구매 확정',
        rejected: '거절됨',
        cancelled: '취소됨'
    };

    const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        paid: 'bg-blue-100 text-blue-800',
        shipped: 'bg-purple-100 text-purple-800',
        confirmed: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        cancelled: 'bg-gray-100 text-gray-800'
    };

    let processing = $state<Record<string, boolean>>({});

    async function confirmReceipt(id: string): Promise<void> {
        if (processing[id] || !confirm('구매를 확정하시겠습니까? 확정 후에는 취소할 수 없습니다.'))
            return;
        processing = { ...processing, [id]: true };
        try {
            const res = await fetch(`/api/commerce/escrow/transactions/${id}/confirm`, {
                method: 'POST'
            });
            if (res.ok) window.location.reload();
            else alert('구매 확정에 실패했습니다');
        } finally {
            processing = { ...processing, [id]: false };
        }
    }

    async function rejectEscrow(id: string): Promise<void> {
        if (processing[id] || !confirm('거래를 거절하시겠습니까?')) return;
        processing = { ...processing, [id]: true };
        try {
            const res = await fetch(`/api/commerce/escrow/transactions/${id}/reject`, {
                method: 'POST'
            });
            if (res.ok) window.location.reload();
            else alert('거절 처리에 실패했습니다');
        } finally {
            processing = { ...processing, [id]: false };
        }
    }
</script>

<svelte:head>
    <title>안전결제 내역 - 다모앙 상점</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-6">
    <h1 class="mb-6 flex items-center gap-2 text-2xl font-bold">
        <Shield class="h-6 w-6" />
        안전결제 내역
    </h1>

    {#if transactions.length === 0}
        <div class="text-muted-foreground py-12 text-center">안전결제 내역이 없습니다.</div>
    {:else}
        <div class="space-y-4">
            {#each transactions as tx (tx.id)}
                <div class="rounded-lg border p-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm font-medium">{tx.product_name || '상품'}</p>
                            <p class="text-muted-foreground text-xs">
                                {new Date(tx.created_at).toLocaleDateString('ko-KR')}
                            </p>
                        </div>
                        <span
                            class="rounded-full px-2.5 py-0.5 text-xs font-semibold {statusColors[
                                tx.status
                            ] || 'bg-gray-100'}"
                        >
                            {statusLabels[tx.status] || tx.status}
                        </span>
                    </div>
                    <div class="mt-2 flex items-center justify-between">
                        <span class="text-primary font-bold"
                            >{Number(tx.amount).toLocaleString()}원</span
                        >
                        <div class="flex gap-2">
                            {#if tx.status === 'shipped'}
                                <Button
                                    size="sm"
                                    onclick={() => confirmReceipt(tx.id)}
                                    disabled={processing[tx.id]}
                                >
                                    구매 확정
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onclick={() => rejectEscrow(tx.id)}
                                    disabled={processing[tx.id]}
                                >
                                    거절
                                </Button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
