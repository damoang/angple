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
        Ticket,
        Plus,
        Search,
        Edit,
        Trash2,
        ArrowLeft,
        ChevronLeft,
        ChevronRight
    } from '@lucide/svelte';
    import { type Coupon, formatCurrency, formatDate } from '$lib/api/commerce';

    let coupons = $state<Coupon[]>([]);
    let isLoading = $state(true);
    let searchQuery = $state('');
    let currentPage = $state(1);
    let totalPages = $state(1);

    // Mock 데이터
    const mockCoupons: Coupon[] = [
        {
            id: 1,
            code: 'WELCOME10',
            name: '신규 가입 10% 할인',
            description: '신규 회원 첫 구매 시 10% 할인',
            discount_type: 'percentage',
            discount_value: 10,
            min_order_amount: 10000,
            max_discount_amount: 5000,
            usage_limit: 1000,
            usage_count: 234,
            start_date: '2026-01-01T00:00:00Z',
            end_date: '2026-12-31T23:59:59Z',
            is_active: true,
            is_public: true,
            created_at: '2025-12-15T00:00:00Z'
        },
        {
            id: 2,
            code: 'FREESHIP',
            name: '무료 배송 쿠폰',
            description: '5만원 이상 구매 시 무료 배송',
            discount_type: 'free_shipping',
            discount_value: 0,
            min_order_amount: 50000,
            usage_limit: 500,
            usage_count: 89,
            start_date: '2026-01-01T00:00:00Z',
            end_date: '2026-03-31T23:59:59Z',
            is_active: true,
            is_public: true,
            created_at: '2025-12-20T00:00:00Z'
        },
        {
            id: 3,
            code: 'VIP5000',
            name: 'VIP 5000원 할인',
            description: 'VIP 회원 전용 5000원 할인',
            discount_type: 'fixed',
            discount_value: 5000,
            min_order_amount: 30000,
            usage_count: 45,
            is_active: true,
            is_public: false,
            created_at: '2026-01-10T00:00:00Z'
        },
        {
            id: 4,
            code: 'EXPIRED20',
            name: '만료된 20% 할인',
            description: '이벤트 종료',
            discount_type: 'percentage',
            discount_value: 20,
            usage_limit: 100,
            usage_count: 100,
            start_date: '2025-11-01T00:00:00Z',
            end_date: '2025-11-30T23:59:59Z',
            is_active: false,
            is_public: false,
            created_at: '2025-10-25T00:00:00Z'
        }
    ];

    onMount(async () => {
        try {
            await new Promise((resolve) => setTimeout(resolve, 500));
            coupons = mockCoupons;
            totalPages = 1;
        } finally {
            isLoading = false;
        }
    });

    function getDiscountTypeLabel(type: string) {
        const labels: Record<string, string> = {
            fixed: '정액 할인',
            percentage: '정률 할인',
            free_shipping: '무료 배송'
        };
        return labels[type] || type;
    }

    function formatDiscount(coupon: Coupon) {
        switch (coupon.discount_type) {
            case 'fixed':
                return formatCurrency(coupon.discount_value);
            case 'percentage':
                return `${coupon.discount_value}%`;
            case 'free_shipping':
                return '무료 배송';
            default:
                return '-';
        }
    }

    const filteredCoupons = $derived(
        coupons.filter((c) => {
            return (
                c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        })
    );

    function deleteCoupon(id: number) {
        if (confirm('이 쿠폰을 삭제하시겠습니까?')) {
            coupons = coupons.filter((c) => c.id !== id);
        }
    }
</script>

<div class="container mx-auto p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/commerce">
            <ArrowLeft class="h-4 w-4" />
        </Button>
        <div class="flex-1">
            <h1 class="text-4xl font-bold">쿠폰 관리</h1>
            <p class="text-muted-foreground mt-2">할인 쿠폰을 관리합니다.</p>
        </div>
        <Button>
            <Plus class="mr-2 h-4 w-4" />
            쿠폰 생성
        </Button>
    </div>

    <!-- 검색 -->
    <Card class="mb-6">
        <CardContent class="pt-6">
            <div class="relative">
                <Search
                    class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                />
                <Input
                    type="search"
                    placeholder="쿠폰 코드 또는 이름 검색..."
                    class="pl-10"
                    bind:value={searchQuery}
                />
            </div>
        </CardContent>
    </Card>

    <!-- 쿠폰 목록 -->
    {#if isLoading}
        <div class="flex h-64 items-center justify-center">
            <div class="text-muted-foreground">로딩 중...</div>
        </div>
    {:else if filteredCoupons.length === 0}
        <Card>
            <CardContent class="py-12 text-center">
                <Ticket class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">쿠폰이 없습니다</h2>
                <p class="text-muted-foreground">새 쿠폰을 생성해보세요.</p>
            </CardContent>
        </Card>
    {:else}
        <Card>
            <CardHeader>
                <CardTitle>쿠폰 목록</CardTitle>
                <CardDescription>총 {filteredCoupons.length}개의 쿠폰</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="border-b text-left">
                                <th class="pb-3 font-medium">쿠폰 코드</th>
                                <th class="pb-3 font-medium">이름</th>
                                <th class="pb-3 font-medium">할인</th>
                                <th class="pb-3 font-medium">최소 주문</th>
                                <th class="pb-3 font-medium">사용/제한</th>
                                <th class="pb-3 font-medium">유효기간</th>
                                <th class="pb-3 font-medium">상태</th>
                                <th class="pb-3 font-medium">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredCoupons as coupon (coupon.id)}
                                <tr class="border-b last:border-0">
                                    <td class="py-4">
                                        <code class="bg-muted rounded px-2 py-1 font-mono text-sm"
                                            >{coupon.code}</code
                                        >
                                    </td>
                                    <td class="py-4">
                                        <div class="font-medium">{coupon.name}</div>
                                        <div class="text-muted-foreground line-clamp-1 text-sm">
                                            {coupon.description}
                                        </div>
                                    </td>
                                    <td class="py-4">
                                        <Badge variant="outline">{formatDiscount(coupon)}</Badge>
                                    </td>
                                    <td class="py-4">
                                        {coupon.min_order_amount
                                            ? formatCurrency(coupon.min_order_amount)
                                            : '-'}
                                    </td>
                                    <td class="py-4">
                                        <div>
                                            {coupon.usage_count.toLocaleString()} / {coupon.usage_limit?.toLocaleString() ||
                                                '무제한'}
                                        </div>
                                        {#if coupon.usage_limit}
                                            <div class="bg-muted mt-1 h-1.5 w-20 rounded-full">
                                                <div
                                                    class="bg-primary h-1.5 rounded-full"
                                                    style="width: {Math.min(
                                                        (coupon.usage_count / coupon.usage_limit) *
                                                            100,
                                                        100
                                                    )}%"
                                                ></div>
                                            </div>
                                        {/if}
                                    </td>
                                    <td class="py-4 text-sm">
                                        {#if coupon.start_date && coupon.end_date}
                                            {formatDate(coupon.start_date).split(' ')[0]} ~
                                            {formatDate(coupon.end_date).split(' ')[0]}
                                        {:else}
                                            무제한
                                        {/if}
                                    </td>
                                    <td class="py-4">
                                        <div class="flex flex-col gap-1">
                                            {#if coupon.is_active}
                                                <Badge variant="default">활성</Badge>
                                            {:else}
                                                <Badge variant="secondary">비활성</Badge>
                                            {/if}
                                            {#if coupon.is_public}
                                                <Badge variant="outline">공개</Badge>
                                            {:else}
                                                <Badge variant="outline">비공개</Badge>
                                            {/if}
                                        </div>
                                    </td>
                                    <td class="py-4">
                                        <div class="flex gap-1">
                                            <Button variant="ghost" size="icon" title="수정">
                                                <Edit class="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="삭제"
                                                onclick={() => deleteCoupon(coupon.id)}
                                            >
                                                <Trash2 class="h-4 w-4" />
                                            </Button>
                                        </div>
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
