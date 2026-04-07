<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import Minus from '@lucide/svelte/icons/minus';
    import Plus from '@lucide/svelte/icons/plus';
    import ArrowRight from '@lucide/svelte/icons/arrow-right';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const cart = $derived(data.cart);
    const items = $derived(cart?.items ?? []);
    const isEmpty = $derived(items.length === 0);

    let updating = $state<Record<number, boolean>>({});

    async function updateQuantity(cartItemId: number, quantity: number): Promise<void> {
        if (quantity < 1 || updating[cartItemId]) return;
        updating[cartItemId] = true;
        try {
            const res = await fetch(`/api/commerce/cart/${cartItemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity })
            });
            if (res.ok) await invalidateAll();
        } finally {
            updating[cartItemId] = false;
        }
    }

    async function removeItem(cartItemId: number): Promise<void> {
        if (updating[cartItemId]) return;
        updating[cartItemId] = true;
        try {
            const res = await fetch(`/api/commerce/cart/${cartItemId}`, { method: 'DELETE' });
            if (res.ok) await invalidateAll();
        } finally {
            updating[cartItemId] = false;
        }
    }

    let clearing = $state(false);
    async function clearCart(): Promise<void> {
        if (clearing || isEmpty) return;
        clearing = true;
        try {
            const res = await fetch('/api/commerce/cart', { method: 'DELETE' });
            if (res.ok) await invalidateAll();
        } finally {
            clearing = false;
        }
    }

    let ordering = $state(false);
    async function handleOrder(): Promise<void> {
        if (ordering || isEmpty) return;
        ordering = true;
        try {
            const orderItems = items.map((item: any) => ({
                product_id: item.product.id,
                quantity: item.quantity
            }));
            const res = await fetch('/api/commerce/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: orderItems })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || '주문 생성에 실패했습니다');
            }
            const orderData = await res.json();
            window.location.href = `/checkout/${orderData.data.id}`;
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : '주문 생성에 실패했습니다');
        } finally {
            ordering = false;
        }
    }
</script>

<svelte:head>
    <title>장바구니 - 다모앙 상점</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-6">
    <h1 class="mb-6 text-2xl font-bold">장바구니</h1>

    {#if !cart || isEmpty}
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <ShoppingCart class="text-muted-foreground mb-4 h-16 w-16" />
            <p class="text-muted-foreground text-lg">장바구니가 비어있습니다</p>
            <a href="/shop" class="text-primary mt-4 text-sm hover:underline">상점 둘러보기</a>
        </div>
    {:else}
        <div class="space-y-4">
            {#each items as item (item.id)}
                {@const product = item.product}
                <div class="flex gap-4 rounded-lg border p-4">
                    {#if product.featured_image}
                        <a href="/shop/{product.id}" class="shrink-0">
                            <img
                                src={product.featured_image}
                                alt={product.name}
                                class="h-20 w-20 rounded-md object-cover"
                            />
                        </a>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <a href="/shop/{product.id}" class="font-medium hover:underline">
                            {product.name}
                        </a>
                        <p class="text-primary mt-1 font-bold">
                            {Number(product.price).toLocaleString()}원
                        </p>
                        <div class="mt-2 flex items-center gap-2">
                            <button
                                class="border-input hover:bg-muted rounded border p-1 disabled:opacity-30"
                                onclick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1 || updating[item.id]}
                            >
                                <Minus class="h-3.5 w-3.5" />
                            </button>
                            <span class="w-8 text-center text-sm">{item.quantity}</span>
                            <button
                                class="border-input hover:bg-muted rounded border p-1 disabled:opacity-30"
                                onclick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={updating[item.id]}
                            >
                                <Plus class="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                    <div class="flex flex-col items-end justify-between">
                        <button
                            class="text-muted-foreground hover:text-destructive p-1"
                            onclick={() => removeItem(item.id)}
                            disabled={updating[item.id]}
                            title="삭제"
                        >
                            <Trash2 class="h-4 w-4" />
                        </button>
                        <p class="text-sm font-semibold">
                            {Number(item.subtotal).toLocaleString()}원
                        </p>
                    </div>
                </div>
            {/each}
        </div>

        <!-- 하단 요약 -->
        <div class="mt-6 rounded-lg border p-4">
            <div class="flex justify-between text-sm">
                <span class="text-muted-foreground"
                    >상품 {cart.item_count}종 ({cart.total_count}개)</span
                >
                <span class="text-lg font-bold">{Number(cart.subtotal).toLocaleString()}원</span>
            </div>
            <div class="mt-4 flex gap-2">
                <Button variant="outline" onclick={clearCart} disabled={clearing} class="shrink-0">
                    <Trash2 class="mr-1 h-4 w-4" />
                    비우기
                </Button>
                <Button class="flex-1" size="lg" onclick={handleOrder} disabled={ordering}>
                    {#if ordering}
                        주문 생성 중...
                    {:else}
                        주문하기
                        <ArrowRight class="ml-1 h-4 w-4" />
                    {/if}
                </Button>
            </div>
        </div>
    {/if}
</div>
