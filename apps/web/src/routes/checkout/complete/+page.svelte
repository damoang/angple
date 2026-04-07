<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import CheckCircle from '@lucide/svelte/icons/check-circle';
    import XCircle from '@lucide/svelte/icons/x-circle';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
</script>

<svelte:head>
    <title>{data.success ? '결제 완료' : '결제 실패'} - 다모앙</title>
</svelte:head>

<div class="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
    {#if data.success}
        <div class="mb-6 rounded-full bg-green-100 p-4 dark:bg-green-900">
            <CheckCircle class="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <h1 class="text-2xl font-bold">결제가 완료되었습니다</h1>
        <p class="text-muted-foreground mt-2">주문이 성공적으로 처리되었습니다.</p>

        {#if data.payment}
            <div class="mt-6 w-full rounded-lg border p-4 text-left">
                <div class="space-y-2 text-sm">
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">결제 금액</span>
                        <span class="font-medium">{data.payment.amount?.toLocaleString()}원</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">결제 수단</span>
                        <span
                            >{data.payment.payment_method === 'card'
                                ? '카드'
                                : data.payment.payment_method}</span
                        >
                    </div>
                    {#if data.payment.card_company}
                        <div class="flex justify-between">
                            <span class="text-muted-foreground">카드</span>
                            <span>{data.payment.card_company} {data.payment.card_number}</span>
                        </div>
                    {/if}
                    <div class="flex justify-between">
                        <span class="text-muted-foreground">결제 일시</span>
                        <span>{new Date(data.payment.paid_at).toLocaleString('ko-KR')}</span>
                    </div>
                </div>
            </div>
        {/if}

        <div class="mt-8 flex gap-3">
            <Button variant="outline" onclick={() => goto('/')}>홈으로</Button>
            <Button onclick={() => goto('/member/orders')}>주문 내역</Button>
        </div>
    {:else}
        <div class="mb-6 rounded-full bg-red-100 p-4 dark:bg-red-900">
            <XCircle class="h-12 w-12 text-red-600 dark:text-red-400" />
        </div>
        <h1 class="text-2xl font-bold">결제에 실패했습니다</h1>
        <p class="text-muted-foreground mt-2">{data.error || '알 수 없는 오류가 발생했습니다.'}</p>

        <div class="mt-8 flex gap-3">
            <Button variant="outline" onclick={() => goto('/')}>홈으로</Button>
            <Button onclick={() => history.back()}>다시 시도</Button>
        </div>
    {/if}
</div>
