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
    import { Input } from '$lib/components/ui/input';
    import {
        ShoppingCart,
        Search,
        Eye,
        ArrowLeft,
        ChevronLeft,
        ChevronRight
    } from '@lucide/svelte';
    import {
        type Order,
        type OrderStatus,
        formatCurrency,
        formatDate,
        getOrderStatusLabel,
        getOrderStatusVariant
    } from '$lib/api/commerce';

    let orders = $state<Order[]>([]);
    let isLoading = $state(true);
    let searchQuery = $state('');
    let statusFilter = $state<string>('all');
    let currentPage = $state(1);
    let totalPages = $state(1);

    // Mock 데이터
    const mockOrders: Order[] = [
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
            shipping_name: '홍길동',
            shipping_phone: '010-1234-5678',
            shipping_address: '서울시 강남구 테헤란로 123',
            shipping_postal: '06234',
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
            shipping_name: '김철수',
            shipping_phone: '010-9876-5432',
            shipping_address: '부산시 해운대구 센텀로 456',
            shipping_postal: '48058',
            carrier_code: 'cj',
            tracking_number: '1234567890',
            shipped_at: '2026-01-28T16:00:00Z',
            created_at: '2026-01-28T14:20:00Z',
            updated_at: '2026-01-28T16:00:00Z'
        },
        {
            id: 4,
            order_number: '20260127-JKL012',
            user_id: 4,
            subtotal: 99000,
            discount: 10000,
            shipping_fee: 0,
            total: 89000,
            currency: 'KRW',
            status: 'completed',
            completed_at: '2026-01-27T12:00:00Z',
            created_at: '2026-01-20T08:30:00Z',
            updated_at: '2026-01-27T12:00:00Z'
        },
        {
            id: 5,
            order_number: '20260126-MNO345',
            user_id: 5,
            subtotal: 25000,
            discount: 0,
            shipping_fee: 3000,
            total: 28000,
            currency: 'KRW',
            status: 'cancelled',
            cancelled_at: '2026-01-26T10:00:00Z',
            created_at: '2026-01-25T15:00:00Z',
            updated_at: '2026-01-26T10:00:00Z'
        }
    ];

    onMount(async () => {
        try {
            await new Promise((resolve) => setTimeout(resolve, 500));
            orders = mockOrders;
            totalPages = 3;
        } finally {
            isLoading = false;
        }
    });

    const filteredOrders = $derived(
        orders.filter((o) => {
            const matchesSearch = o.order_number.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
    );
</script>

<div class="container mx-auto p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/commerce">
            <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
            <h1 class="text-4xl font-bold">주문 관리</h1>
            <p class="text-muted-foreground mt-2">접수된 주문을 관리합니다.</p>
        </div>
    </div>

    <!-- 필터 및 검색 -->
    <Card class="mb-6">
        <CardContent class="pt-6">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div class="relative flex-1">
                    <Search
                        class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    />
                    <Input
                        type="search"
                        placeholder="주문번호 검색..."
                        class="pl-10"
                        bind:value={searchQuery}
                    />
                </div>
                <div class="flex gap-2">
                    <select
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                        bind:value={statusFilter}
                    >
                        <option value="all">전체 상태</option>
                        <option value="pending">결제 대기</option>
                        <option value="paid">결제 완료</option>
                        <option value="processing">처리 중</option>
                        <option value="shipped">배송 중</option>
                        <option value="delivered">배송 완료</option>
                        <option value="completed">구매 확정</option>
                        <option value="cancelled">취소됨</option>
                        <option value="refunded">환불됨</option>
                    </select>
                </div>
            </div>
        </CardContent>
    </Card>

    <!-- 주문 목록 -->
    {#if isLoading}
        <div class="flex h-64 items-center justify-center">
            <div class="text-muted-foreground">로딩 중...</div>
        </div>
    {:else if filteredOrders.length === 0}
        <Card>
            <CardContent class="py-12 text-center">
                <ShoppingCart class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">주문이 없습니다</h2>
                <p class="text-muted-foreground">검색 조건에 맞는 주문이 없습니다.</p>
            </CardContent>
        </Card>
    {:else}
        <Card>
            <CardHeader>
                <CardTitle>주문 목록</CardTitle>
                <CardDescription>총 {filteredOrders.length}개의 주문</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="border-b text-left">
                                <th class="pb-3 font-medium">주문번호</th>
                                <th class="pb-3 font-medium">주문자</th>
                                <th class="pb-3 font-medium">결제금액</th>
                                <th class="pb-3 font-medium">상태</th>
                                <th class="pb-3 font-medium">송장번호</th>
                                <th class="pb-3 font-medium">주문일시</th>
                                <th class="pb-3 font-medium">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredOrders as order (order.id)}
                                <tr class="border-b last:border-0">
                                    <td class="py-4">
                                        <div class="font-medium">{order.order_number}</div>
                                    </td>
                                    <td class="py-4">
                                        {#if order.shipping_name}
                                            <div>{order.shipping_name}</div>
                                            <div class="text-muted-foreground text-sm">
                                                {order.shipping_phone}
                                            </div>
                                        {:else}
                                            <span class="text-muted-foreground">디지털 상품</span>
                                        {/if}
                                    </td>
                                    <td class="py-4">
                                        <div class="font-medium">{formatCurrency(order.total)}</div>
                                        {#if order.discount > 0}
                                            <div class="text-muted-foreground text-sm">
                                                할인: -{formatCurrency(order.discount)}
                                            </div>
                                        {/if}
                                    </td>
                                    <td class="py-4">
                                        <Badge variant={getOrderStatusVariant(order.status)}>
                                            {getOrderStatusLabel(order.status)}
                                        </Badge>
                                    </td>
                                    <td class="py-4">
                                        {#if order.tracking_number}
                                            <div class="text-sm">{order.tracking_number}</div>
                                        {:else}
                                            <span class="text-muted-foreground text-sm">-</span>
                                        {/if}
                                    </td>
                                    <td class="py-4 text-sm">{formatDate(order.created_at)}</td>
                                    <td class="py-4">
                                        <Button variant="ghost" size="icon" title="상세보기">
                                            <Eye class="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- 페이지네이션 -->
                <div class="mt-4 flex items-center justify-between">
                    <div class="text-muted-foreground text-sm">
                        페이지 {currentPage} / {totalPages}
                    </div>
                    <div class="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === 1}
                            onclick={() => (currentPage = Math.max(1, currentPage - 1))}
                        >
                            <ChevronLeft class="h-4 w-4" />
                            이전
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage === totalPages}
                            onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
                        >
                            다음
                            <ChevronRight class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    {/if}
</div>
