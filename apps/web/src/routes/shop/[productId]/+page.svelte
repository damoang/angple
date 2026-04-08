<script lang="ts">
    import { goto } from '$app/navigation';
    import { Button } from '$lib/components/ui/button/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import Truck from '@lucide/svelte/icons/truck';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import Shield from '@lucide/svelte/icons/shield';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
    const product = $derived(data.product);

    let isOrdering = $state(false);
    let isAddingToCart = $state(false);
    let selectedImage = $state(0);
    let activeTab = $state<'desc' | 'reviews' | 'shipping' | 'refund'>('desc');
    let reviews = $state<any[]>([]);
    let reviewsLoading = $state(false);
    let reviewsLoaded = $state(false);

    async function loadReviews(): Promise<void> {
        if (reviewsLoaded || reviewsLoading) return;
        reviewsLoading = true;
        try {
            const res = await fetch(`/api/commerce/products/${product.id}/reviews`);
            if (res.ok) {
                const data = await res.json();
                reviews = data.data?.items ?? data.data ?? [];
            }
        } catch {
            /* ignore */
        } finally {
            reviewsLoading = false;
            reviewsLoaded = true;
        }
    }

    const allImages = $derived(() => {
        const imgs: string[] = [];
        if (product.featured_image) imgs.push(product.featured_image);
        if (product.gallery_images && Array.isArray(product.gallery_images)) {
            imgs.push(...product.gallery_images);
        }
        return imgs;
    });

    async function handleBuy(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        if (isOrdering) return;
        isOrdering = true;

        try {
            const res = await fetch('/api/commerce/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: [{ product_id: product.id, quantity: 1 }]
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || '주문 생성에 실패했습니다');
            }

            const orderData = await res.json();
            goto(`/checkout/${orderData.data.id}`);
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : '주문 생성에 실패했습니다');
        } finally {
            isOrdering = false;
        }
    }

    async function handleAddToCart(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        if (isAddingToCart) return;
        isAddingToCart = true;
        try {
            const res = await fetch('/api/commerce/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: product.id, quantity: 1 })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || '장바구니 추가에 실패했습니다');
            }
            alert('장바구니에 담았습니다');
        } catch (err: unknown) {
            alert(err instanceof Error ? err.message : '장바구니 추가에 실패했습니다');
        } finally {
            isAddingToCart = false;
        }
    }

    const hasDiscount = $derived(
        product.original_price && Number(product.original_price) > Number(product.price)
    );
    const discountRate = $derived(
        hasDiscount
            ? Math.round((1 - Number(product.price) / Number(product.original_price)) * 100)
            : 0
    );
</script>

<svelte:head>
    <title>{product.name} - 다모앙 상점</title>
    <meta name="description" content={product.short_desc || product.name} />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-6">
    <!-- 뒤로가기 -->
    <button
        class="text-muted-foreground mb-4 flex items-center gap-1 text-sm hover:underline"
        onclick={() => history.back()}
    >
        <ArrowLeft class="h-4 w-4" />
        상점으로 돌아가기
    </button>

    <div class="grid gap-8 md:grid-cols-2">
        <!-- 상품 이미지 영역 -->
        <div>
            <!-- 메인 이미지 -->
            <div class="overflow-hidden rounded-lg border">
                {#if allImages().length > 0}
                    <img
                        src={allImages()[selectedImage]}
                        alt={product.name}
                        class="aspect-square w-full object-cover"
                    />
                {:else}
                    <div class="bg-muted flex aspect-square items-center justify-center">
                        <ShoppingCart class="text-muted-foreground h-16 w-16" />
                    </div>
                {/if}
            </div>

            <!-- 썸네일 갤러리 -->
            {#if allImages().length > 1}
                <div class="mt-3 flex gap-2 overflow-x-auto">
                    {#each allImages() as img, i}
                        <button
                            class="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all {selectedImage ===
                            i
                                ? 'border-primary'
                                : 'border-transparent opacity-60 hover:opacity-100'}"
                            onclick={() => (selectedImage = i)}
                        >
                            <img
                                src={img}
                                alt="{product.name} {i + 1}"
                                class="h-full w-full object-cover"
                            />
                        </button>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- 상품 정보 -->
        <div class="flex flex-col">
            <h1 class="text-2xl font-bold">{product.name}</h1>

            {#if product.short_desc}
                <p class="text-muted-foreground mt-2 text-sm">{product.short_desc}</p>
            {/if}

            <!-- 가격 -->
            <div class="bg-muted mt-4 rounded-xl p-4">
                {#if hasDiscount}
                    <div class="flex items-center gap-2">
                        <span
                            class="rounded-full bg-red-500 px-2.5 py-0.5 text-sm font-bold text-white"
                            >{discountRate}%</span
                        >
                        <span class="text-muted-foreground text-base line-through">
                            {Number(product.original_price).toLocaleString()}원
                        </span>
                    </div>
                {/if}
                <p class="mt-1 text-3xl font-bold">
                    {Number(product.price).toLocaleString()}<span class="text-xl">원</span>
                </p>
            </div>

            <!-- 상품 유형 & 배송 -->
            <div class="mt-4 space-y-2">
                <div class="flex items-center gap-2 text-sm">
                    <Truck class="text-muted-foreground h-4 w-4" />
                    {#if product.product_type === 'digital'}
                        <span>디지털 상품 · 구매 즉시 다운로드</span>
                    {:else}
                        <span>배송비 3,000원 (50,000원 이상 무료배송)</span>
                    {/if}
                </div>
                <div class="flex items-center gap-2 text-sm">
                    <RotateCcw class="text-muted-foreground h-4 w-4" />
                    <span>수령 후 7일 이내 교환/환불 가능</span>
                </div>
                <div class="flex items-center gap-2 text-sm">
                    <Shield class="text-muted-foreground h-4 w-4" />
                    <span>안전결제 (토스페이먼츠)</span>
                </div>
            </div>

            <!-- 재고 -->
            {#if product.stock_status === 'out_of_stock'}
                <p class="mt-3 font-medium text-red-500">품절</p>
            {:else if product.stock_quantity !== null && product.stock_quantity <= 5}
                <p class="mt-3 text-sm text-orange-500">
                    남은 수량: {product.stock_quantity}개
                </p>
            {/if}

            <!-- 판매량/평점 -->
            <div class="text-muted-foreground mt-4 flex gap-4 text-sm">
                {#if product.sales_count > 0}
                    <span>판매 {product.sales_count}건</span>
                {/if}
                {#if Number(product.rating_avg) > 0}
                    <span
                        >★ {Number(product.rating_avg).toFixed(1)} ({product.rating_count}개 리뷰)</span
                    >
                {/if}
            </div>

            <!-- 구매 버튼 -->
            <div class="mt-6 space-y-2">
                <Button
                    class="w-full"
                    size="lg"
                    onclick={handleBuy}
                    disabled={isOrdering || product.stock_status === 'out_of_stock'}
                >
                    {#if product.stock_status === 'out_of_stock'}
                        품절
                    {:else if isOrdering}
                        주문 생성 중...
                    {:else}
                        바로 구매하기
                    {/if}
                </Button>
                {#if product.stock_status !== 'out_of_stock'}
                    <Button
                        variant="outline"
                        class="w-full"
                        size="lg"
                        onclick={handleAddToCart}
                        disabled={isAddingToCart}
                    >
                        <ShoppingCart class="mr-2 h-5 w-5" />
                        {#if isAddingToCart}
                            담는 중...
                        {:else}
                            장바구니 담기
                        {/if}
                    </Button>
                {/if}
            </div>
        </div>
    </div>

    <!-- 탭 영역: 상품설명 / 배송안내 / 교환환불 -->
    <div class="mt-10 border-t">
        <div class="flex border-b">
            <button
                class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'desc'
                    ? 'border-b-2 border-black text-black dark:border-white dark:text-white'
                    : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => (activeTab = 'desc')}
            >
                상품설명
            </button>
            <button
                class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'reviews'
                    ? 'border-b-2 border-black text-black dark:border-white dark:text-white'
                    : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => {
                    activeTab = 'reviews';
                    loadReviews();
                }}
            >
                리뷰 ({product.rating_count || 0})
            </button>
            <button
                class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'shipping'
                    ? 'border-b-2 border-black text-black dark:border-white dark:text-white'
                    : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => (activeTab = 'shipping')}
            >
                배송안내
            </button>
            <button
                class="px-6 py-3 text-sm font-medium transition-colors {activeTab === 'refund'
                    ? 'border-b-2 border-black text-black dark:border-white dark:text-white'
                    : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => (activeTab = 'refund')}
            >
                교환/환불
            </button>
        </div>

        <div class="py-8">
            {#if activeTab === 'desc'}
                <!-- 상품 설명 -->
                {#if product.description}
                    <div class="prose prose-neutral dark:prose-invert max-w-none">
                        {@html product.description}
                    </div>
                {/if}

                <!-- 갤러리 이미지 (설명 하단) -->
                {#if allImages().length > 1}
                    <div class="mt-8 space-y-4">
                        {#each allImages() as img, i}
                            {#if i > 0}
                                <img
                                    src={img}
                                    alt="{product.name} 상세 {i}"
                                    class="w-full rounded-lg"
                                />
                            {/if}
                        {/each}
                    </div>
                {/if}
            {:else if activeTab === 'reviews'}
                <!-- 리뷰 -->
                {#if reviewsLoading}
                    <div class="text-muted-foreground py-8 text-center text-sm">
                        리뷰 불러오는 중...
                    </div>
                {:else if reviews.length === 0}
                    <div class="text-muted-foreground py-8 text-center text-sm">
                        아직 리뷰가 없습니다
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each reviews as review (review.id)}
                            <div class="rounded-lg border p-4">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-2">
                                        <span class="text-yellow-500"
                                            >{'★'.repeat(review.rating)}{'☆'.repeat(
                                                5 - review.rating
                                            )}</span
                                        >
                                        <span class="text-sm font-medium"
                                            >{review.author_name || '구매자'}</span
                                        >
                                        {#if review.verified_purchase}
                                            <span
                                                class="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                                >구매인증</span
                                            >
                                        {/if}
                                    </div>
                                    <span class="text-muted-foreground text-xs"
                                        >{new Date(review.created_at).toLocaleDateString(
                                            'ko-KR'
                                        )}</span
                                    >
                                </div>
                                {#if review.content}
                                    <p class="mt-2 text-sm">{review.content}</p>
                                {/if}
                                {#if review.helpful_count > 0}
                                    <p class="text-muted-foreground mt-2 text-xs">
                                        👍 {review.helpful_count}명에게 도움됨
                                    </p>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            {:else if activeTab === 'shipping'}
                <!-- 배송 안내 -->
                <div class="prose prose-neutral dark:prose-invert max-w-none">
                    <h3>배송 안내</h3>
                    <table>
                        <tbody>
                            <tr><td class="font-medium">배송 방법</td><td>택배 (CJ대한통운)</td></tr
                            >
                            <tr
                                ><td class="font-medium">배송비</td><td
                                    >3,000원 (50,000원 이상 무료배송)</td
                                ></tr
                            >
                            <tr
                                ><td class="font-medium">배송 기간</td><td
                                    >결제 완료 후 2~5 영업일 이내</td
                                ></tr
                            >
                            <tr
                                ><td class="font-medium">도서산간</td><td>추가 배송비 3,000원</td
                                ></tr
                            >
                        </tbody>
                    </table>
                    <h3>배송 유의사항</h3>
                    <ul>
                        <li>주문 폭주 시 배송이 지연될 수 있습니다.</li>
                        <li>공휴일 및 주말에는 배송이 진행되지 않습니다.</li>
                        <li>배송 추적은 마이페이지 > 주문내역에서 확인하실 수 있습니다.</li>
                    </ul>
                </div>
            {:else if activeTab === 'refund'}
                <!-- 교환/환불 -->
                <div class="prose prose-neutral dark:prose-invert max-w-none">
                    <h3>교환/환불 안내</h3>
                    <table>
                        <tbody>
                            <tr
                                ><td class="font-medium">교환/반품 기간</td><td
                                    >상품 수령일로부터 7일 이내</td
                                ></tr
                            >
                            <tr
                                ><td class="font-medium">교환/반품 배송비</td><td
                                    >고객 변심: 왕복 6,000원 / 상품 하자: 무료</td
                                ></tr
                            >
                            <tr
                                ><td class="font-medium">환불 방법</td><td
                                    >원래 결제수단으로 환불 (영업일 기준 3~5일 소요)</td
                                ></tr
                            >
                        </tbody>
                    </table>
                    <h3>교환/환불이 불가능한 경우</h3>
                    <ul>
                        <li>고객의 사용 또는 일부 소비에 의해 상품의 가치가 감소한 경우</li>
                        <li>시간이 지나 재판매가 곤란할 정도로 상품의 가치가 감소한 경우</li>
                        <li>복제가 가능한 상품의 포장을 훼손한 경우 (디지털 상품 등)</li>
                        <li>주문 제작 상품의 경우</li>
                    </ul>
                </div>
            {/if}
        </div>
    </div>

    <!-- 판매자 정보 -->
    <div class="border-t py-6">
        <h3 class="mb-4 text-sm font-bold">판매자 정보</h3>
        <div class="text-muted-foreground grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div><span class="font-medium">상호명:</span> 주식회사 에스디케이</div>
            <div><span class="font-medium">대표:</span> SDK</div>
            <div><span class="font-medium">사업자등록번호:</span> 871-81-03242</div>
            <div><span class="font-medium">통신판매업:</span> 2024-고양일산서-1820</div>
            <div><span class="font-medium">주소:</span> 제주특별자치도 제주시 남성로 127, 4층</div>
            <div><span class="font-medium">이메일:</span> contact@damoang.net</div>
            <div><span class="font-medium">고객센터:</span> contact@damoang.net</div>
        </div>
    </div>
</div>
