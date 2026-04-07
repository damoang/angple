<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const products = $derived(data.products);
    const totalPages = $derived(Math.ceil(data.total / data.limit));
</script>

<svelte:head>
    <title>상점 - 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-6">
    <h1 class="mb-6 text-2xl font-bold">상점</h1>

    {#if products.length === 0}
        <div class="text-muted-foreground flex flex-col items-center py-16">
            <ShoppingBag class="mb-4 h-16 w-16" />
            <p>등록된 상품이 없습니다.</p>
        </div>
    {:else}
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {#each products as product}
                <button
                    class="group cursor-pointer overflow-hidden rounded-lg border text-left transition-shadow hover:shadow-md"
                    onclick={() => goto(`/shop/${product.id}`)}
                >
                    {#if product.featured_image}
                        <img
                            src={product.featured_image}
                            alt={product.name}
                            class="aspect-square w-full object-cover"
                        />
                    {:else}
                        <div class="bg-muted flex aspect-square items-center justify-center">
                            <ShoppingBag class="text-muted-foreground h-10 w-10" />
                        </div>
                    {/if}
                    <div class="p-3">
                        <p class="line-clamp-2 text-sm font-medium">{product.name}</p>
                        <div class="mt-1">
                            {#if product.original_price && Number(product.original_price) > Number(product.price)}
                                <span class="text-xs text-red-500">
                                    {Math.round(
                                        (1 -
                                            Number(product.price) /
                                                Number(product.original_price)) *
                                            100
                                    )}%
                                </span>
                                <span class="text-muted-foreground ml-1 text-xs line-through">
                                    {Number(product.original_price).toLocaleString()}원
                                </span>
                            {/if}
                            <p class="text-base font-bold">
                                {Number(product.price).toLocaleString()}원
                            </p>
                        </div>
                        {#if product.stock_status === 'out_of_stock'}
                            <p class="mt-1 text-xs text-red-500">품절</p>
                        {/if}
                    </div>
                </button>
            {/each}
        </div>

        <!-- 페이지네이션 -->
        {#if totalPages > 1}
            <div class="mt-8 flex justify-center gap-2">
                {#each Array(totalPages) as _, i}
                    <Button
                        variant={data.page === i + 1 ? 'default' : 'outline'}
                        size="sm"
                        onclick={() => goto(`/shop?page=${i + 1}`)}
                    >
                        {i + 1}
                    </Button>
                {/each}
            </div>
        {/if}
    {/if}
</div>
