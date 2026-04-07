<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import ShoppingBag from '@lucide/svelte/icons/shopping-bag';

    interface OrderItem {
        product_name: string;
        price: number;
        quantity: number;
        subtotal: number;
    }

    interface Props {
        orderNumber: string;
        items: OrderItem[];
        subtotal: number;
        discount?: number;
        shippingFee?: number;
        total: number;
    }

    let { orderNumber, items, subtotal, discount = 0, shippingFee = 0, total }: Props = $props();
</script>

<Card>
    <CardHeader class="pb-3">
        <CardTitle class="flex items-center gap-2 text-base">
            <ShoppingBag class="h-5 w-5" />
            주문 요약
        </CardTitle>
        <p class="text-muted-foreground text-sm">주문번호: {orderNumber}</p>
    </CardHeader>
    <CardContent>
        <div class="space-y-3">
            {#each items as item}
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium">{item.product_name}</p>
                        <p class="text-muted-foreground text-xs">수량: {item.quantity}</p>
                    </div>
                    <p class="text-sm">{item.subtotal.toLocaleString()}원</p>
                </div>
            {/each}

            <div class="border-t pt-3">
                <div class="flex justify-between text-sm">
                    <span class="text-muted-foreground">상품 금액</span>
                    <span>{subtotal.toLocaleString()}원</span>
                </div>
                {#if discount > 0}
                    <div class="flex justify-between text-sm text-red-500">
                        <span>할인</span>
                        <span>-{discount.toLocaleString()}원</span>
                    </div>
                {/if}
                {#if shippingFee > 0}
                    <div class="flex justify-between text-sm">
                        <span class="text-muted-foreground">배송비</span>
                        <span>{shippingFee.toLocaleString()}원</span>
                    </div>
                {/if}
            </div>

            <div class="flex justify-between border-t pt-3 text-lg font-bold">
                <span>총 결제금액</span>
                <span class="text-primary">{total.toLocaleString()}원</span>
            </div>
        </div>
    </CardContent>
</Card>
