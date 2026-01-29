<script lang="ts">
    import { onMount } from 'svelte';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import { Button } from '$lib/components/ui/button';
    import {
        ShoppingCart,
        Package,
        DollarSign,
        ClipboardList,
        TrendingUp,
        ArrowRight,
        AlertCircle
    } from '@lucide/svelte';
    import {
        type CommerceDashboard,
        formatCurrency,
        formatDate,
        getOrderStatusLabel,
        getOrderStatusVariant
    } from '$lib/api/admin-commerce';

    let dashboard = $state<CommerceDashboard | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // Mock 데이터 (API 연동 전 테스트용)
    const mockDashboard: CommerceDashboard = {
        total_products: 125,
        total_orders: 1847,
        total_revenue: 15847000,
        pending_orders: 23,
        pending_settlements: 5,
        recent_orders: [
            {
                id: 1,
                order_number: '20260129-ABC123',
                user_id: 1,
                subtotal: 50000,
                discount: 5000,
                shipping_fee: 3000,
                total: 48000,
                currency: 'KRW',
                status: 'paid',
                created_at: '2026-01-29T10:30:00Z',
                updated_at: '2026-01-29T10:30:00Z'
            },
            {
                id: 2,
                order_number: '20260129-DEF456',
                user_id: 2,
                subtotal: 120000,
                discount: 0,
                shipping_fee: 0,
                total: 120000,
                currency: 'KRW',
                status: 'processing',
                created_at: '2026-01-29T09:15:00Z',
                updated_at: '2026-01-29T09:15:00Z'
            },
            {
                id: 3,
                order_number: '20260128-GHI789',
                user_id: 3,
                subtotal: 35000,
                discount: 0,
                shipping_fee: 3000,
                total: 38000,
                currency: 'KRW',
                status: 'shipped',
                created_at: '2026-01-28T14:20:00Z',
                updated_at: '2026-01-28T14:20:00Z'
            }
        ],
        top_products: [
            {
                id: 1,
                seller_id: 1,
                name: '프리미엄 디지털 강좌',
                slug: 'premium-digital-course',
                description: '',
                short_desc: '',
                product_type: 'digital',
                price: 99000,
                currency: 'KRW',
                stock_status: 'in_stock',
                status: 'published',
                visibility: 'public',
                featured_image: '',
                sales_count: 234,
                view_count: 5420,
                created_at: '2025-06-01T00:00:00Z',
                updated_at: '2026-01-29T00:00:00Z'
            },
            {
                id: 2,
                seller_id: 1,
                name: '한정판 굿즈 세트',
                slug: 'limited-goods-set',
                description: '',
                short_desc: '',
                product_type: 'physical',
                price: 45000,
                currency: 'KRW',
                stock_quantity: 50,
                stock_status: 'in_stock',
                status: 'published',
                visibility: 'public',
                featured_image: '',
                sales_count: 189,
                view_count: 3200,
                created_at: '2025-08-15T00:00:00Z',
                updated_at: '2026-01-29T00:00:00Z'
            }
        ]
    };

    onMount(async () => {
        try {
            // TODO: 실제 API 연동
            // dashboard = await getDashboard();

            // Mock 데이터 사용
            await new Promise((resolve) => setTimeout(resolve, 500));
            dashboard = mockDashboard;
        } catch (e) {
            error = e instanceof Error ? e.message : '데이터를 불러오는데 실패했습니다.';
        } finally {
            isLoading = false;
        }
    });
</script>

<div class="container mx-auto p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8">
        <h1 class="text-4xl font-bold">Commerce</h1>
        <p class="text-muted-foreground mt-2">쇼핑몰 플러그인 관리 대시보드</p>
    </div>

    {#if isLoading}
        <div class="flex h-64 items-center justify-center">
            <div class="text-muted-foreground">로딩 중...</div>
        </div>
    {:else if error}
        <Card>
            <CardContent class="py-12 text-center">
                <AlertCircle class="text-destructive mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">오류 발생</h2>
                <p class="text-muted-foreground">{error}</p>
                <Button class="mt-4" onclick={() => location.reload()}>다시 시도</Button>
            </CardContent>
        </Card>
    {:else if dashboard}
        <!-- 통계 카드 -->
        <div class="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle class="text-sm font-medium">총 상품</CardTitle>
                    <Package class="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">
                        {dashboard.total_products.toLocaleString()}
                    </div>
                    <p class="text-muted-foreground text-xs">등록된 전체 상품 수</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle class="text-sm font-medium">총 주문</CardTitle>
                    <ShoppingCart class="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{dashboard.total_orders.toLocaleString()}</div>
                    <p class="text-muted-foreground text-xs">
                        <span class="text-orange-500">{dashboard.pending_orders}</span> 건 처리 대기
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle class="text-sm font-medium">총 매출</CardTitle>
                    <DollarSign class="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{formatCurrency(dashboard.total_revenue)}</div>
                    <p class="text-muted-foreground text-xs">
                        <TrendingUp class="mr-1 inline h-3 w-3 text-green-500" />
                        전월 대비 12% 증가
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle class="text-sm font-medium">정산 대기</CardTitle>
                    <ClipboardList class="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{dashboard.pending_settlements}</div>
                    <p class="text-muted-foreground text-xs">처리가 필요한 정산</p>
                </CardContent>
            </Card>
        </div>

        <!-- 메인 콘텐츠 -->
        <div class="grid gap-6 lg:grid-cols-2">
            <!-- 최근 주문 -->
            <Card>
                <CardHeader>
                    <div class="flex items-center justify-between">
                        <div>
                            <CardTitle>최근 주문</CardTitle>
                            <CardDescription>최근 접수된 주문 목록</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" href="/admin/commerce/orders">
                            전체보기
                            <ArrowRight class="ml-1 h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div class="space-y-4">
                        {#each dashboard.recent_orders as order (order.id)}
                            <div
                                class="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                            >
                                <div>
                                    <div class="font-medium">{order.order_number}</div>
                                    <div class="text-muted-foreground text-sm">
                                        {formatDate(order.created_at)}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="font-medium">{formatCurrency(order.total)}</div>
                                    <Badge variant={getOrderStatusVariant(order.status)}>
                                        {getOrderStatusLabel(order.status)}
                                    </Badge>
                                </div>
                            </div>
                        {/each}
                    </div>
                </CardContent>
            </Card>

            <!-- 인기 상품 -->
            <Card>
                <CardHeader>
                    <div class="flex items-center justify-between">
                        <div>
                            <CardTitle>인기 상품</CardTitle>
                            <CardDescription>판매량 기준 상위 상품</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" href="/admin/commerce/products">
                            전체보기
                            <ArrowRight class="ml-1 h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div class="space-y-4">
                        {#each dashboard.top_products as product (product.id)}
                            <div
                                class="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                            >
                                <div>
                                    <div class="font-medium">{product.name}</div>
                                    <div class="text-muted-foreground text-sm">
                                        {product.product_type === 'digital' ? '디지털' : '실물'} 상품
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="font-medium">{formatCurrency(product.price)}</div>
                                    <div class="text-muted-foreground text-sm">
                                        {product.sales_count.toLocaleString()}개 판매
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </CardContent>
            </Card>
        </div>

        <!-- 빠른 링크 -->
        <div class="mt-8">
            <h2 class="mb-4 text-lg font-semibold">빠른 링크</h2>
            <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Button variant="outline" class="h-auto flex-col py-4" href="/admin/commerce/products">
                    <Package class="mb-2 h-6 w-6" />
                    상품 관리
                </Button>
                <Button variant="outline" class="h-auto flex-col py-4" href="/admin/commerce/orders">
                    <ShoppingCart class="mb-2 h-6 w-6" />
                    주문 관리
                </Button>
                <Button variant="outline" class="h-auto flex-col py-4" href="/admin/commerce/settlements">
                    <DollarSign class="mb-2 h-6 w-6" />
                    정산 관리
                </Button>
                <Button variant="outline" class="h-auto flex-col py-4" href="/admin/commerce/coupons">
                    <ClipboardList class="mb-2 h-6 w-6" />
                    쿠폰 관리
                </Button>
                <Button variant="outline" class="h-auto flex-col py-4" href="/admin/commerce/reviews">
                    <TrendingUp class="mb-2 h-6 w-6" />
                    리뷰 관리
                </Button>
            </div>
        </div>
    {/if}
</div>
