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
        DollarSign,
        ArrowLeft,
        ChevronLeft,
        ChevronRight,
        Check,
        Clock,
        AlertCircle
    } from '@lucide/svelte';
    import { type Settlement, formatCurrency, formatDate } from '$lib/api/commerce';

    let settlements = $state<Settlement[]>([]);
    let isLoading = $state(true);
    let statusFilter = $state<string>('all');
    let currentPage = $state(1);
    let totalPages = $state(1);

    // Mock 데이터
    const mockSettlements: Settlement[] = [
        {
            id: 1,
            seller_id: 1,
            period_start: '2026-01-01T00:00:00Z',
            period_end: '2026-01-15T23:59:59Z',
            total_sales: 2500000,
            total_orders: 45,
            pg_fee: 82500,
            platform_fee: 125000,
            net_amount: 2292500,
            status: 'pending',
            created_at: '2026-01-16T00:00:00Z'
        },
        {
            id: 2,
            seller_id: 2,
            period_start: '2026-01-01T00:00:00Z',
            period_end: '2026-01-15T23:59:59Z',
            total_sales: 1800000,
            total_orders: 32,
            pg_fee: 59400,
            platform_fee: 90000,
            net_amount: 1650600,
            status: 'processing',
            created_at: '2026-01-16T00:00:00Z'
        },
        {
            id: 3,
            seller_id: 1,
            period_start: '2025-12-16T00:00:00Z',
            period_end: '2025-12-31T23:59:59Z',
            total_sales: 3200000,
            total_orders: 58,
            pg_fee: 105600,
            platform_fee: 160000,
            net_amount: 2934400,
            status: 'completed',
            processed_at: '2026-01-05T10:00:00Z',
            created_at: '2026-01-01T00:00:00Z'
        }
    ];

    onMount(async () => {
        try {
            await new Promise((resolve) => setTimeout(resolve, 500));
            settlements = mockSettlements;
            totalPages = 2;
        } finally {
            isLoading = false;
        }
    });

    function getStatusBadgeVariant(status: string) {
        switch (status) {
            case 'completed':
                return 'default';
            case 'processing':
                return 'secondary';
            case 'pending':
                return 'outline';
            case 'failed':
                return 'destructive';
            default:
                return 'outline';
        }
    }

    function getStatusLabel(status: string) {
        const labels: Record<string, string> = {
            pending: '정산 대기',
            processing: '처리 중',
            completed: '정산 완료',
            failed: '정산 실패'
        };
        return labels[status] || status;
    }

    function getStatusIcon(status: string) {
        switch (status) {
            case 'completed':
                return Check;
            case 'processing':
                return Clock;
            case 'failed':
                return AlertCircle;
            default:
                return Clock;
        }
    }

    const filteredSettlements = $derived(
        settlements.filter((s) => {
            return statusFilter === 'all' || s.status === statusFilter;
        })
    );

    // 총 정산 대기 금액
    const totalPendingAmount = $derived(
        settlements.filter((s) => s.status === 'pending').reduce((sum, s) => sum + s.net_amount, 0)
    );
</script>

<div class="container mx-auto p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/commerce">
            <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
            <h1 class="text-4xl font-bold">정산 관리</h1>
            <p class="text-muted-foreground mt-2">판매자 정산을 관리합니다.</p>
        </div>
    </div>

    <!-- 요약 카드 -->
    <div class="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">정산 대기</CardTitle>
                <Clock class="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">{formatCurrency(totalPendingAmount)}</div>
                <p class="text-muted-foreground text-xs">
                    {settlements.filter((s) => s.status === 'pending').length}건
                </p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">처리 중</CardTitle>
                <Clock class="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">
                    {settlements.filter((s) => s.status === 'processing').length}건
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">이번 달 완료</CardTitle>
                <Check class="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">
                    {formatCurrency(
                        settlements
                            .filter((s) => s.status === 'completed')
                            .reduce((sum, s) => sum + s.net_amount, 0)
                    )}
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- 필터 -->
    <Card class="mb-6">
        <CardContent class="pt-6">
            <div class="flex items-center gap-4">
                <select
                    class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                    bind:value={statusFilter}
                >
                    <option value="all">전체 상태</option>
                    <option value="pending">정산 대기</option>
                    <option value="processing">처리 중</option>
                    <option value="completed">정산 완료</option>
                    <option value="failed">정산 실패</option>
                </select>
            </div>
        </CardContent>
    </Card>

    <!-- 정산 목록 -->
    {#if isLoading}
        <div class="flex h-64 items-center justify-center">
            <div class="text-muted-foreground">로딩 중...</div>
        </div>
    {:else if filteredSettlements.length === 0}
        <Card>
            <CardContent class="py-12 text-center">
                <DollarSign class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">정산 내역이 없습니다</h2>
                <p class="text-muted-foreground">검색 조건에 맞는 정산이 없습니다.</p>
            </CardContent>
        </Card>
    {:else}
        <Card>
            <CardHeader>
                <CardTitle>정산 목록</CardTitle>
                <CardDescription>총 {filteredSettlements.length}건의 정산</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="border-b text-left">
                                <th class="pb-3 font-medium">정산 기간</th>
                                <th class="pb-3 font-medium">판매자 ID</th>
                                <th class="pb-3 font-medium">총 매출</th>
                                <th class="pb-3 font-medium">PG 수수료</th>
                                <th class="pb-3 font-medium">플랫폼 수수료</th>
                                <th class="pb-3 font-medium">정산 금액</th>
                                <th class="pb-3 font-medium">상태</th>
                                <th class="pb-3 font-medium">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredSettlements as settlement (settlement.id)}
                                <tr class="border-b last:border-0">
                                    <td class="py-4">
                                        <div class="text-sm">
                                            {formatDate(settlement.period_start).split(' ')[0]} ~
                                            {formatDate(settlement.period_end).split(' ')[0]}
                                        </div>
                                    </td>
                                    <td class="py-4">
                                        <div class="font-medium">
                                            판매자 #{settlement.seller_id}
                                        </div>
                                        <div class="text-muted-foreground text-sm">
                                            {settlement.total_orders}건 주문
                                        </div>
                                    </td>
                                    <td class="py-4">{formatCurrency(settlement.total_sales)}</td>
                                    <td class="py-4 text-red-500"
                                        >-{formatCurrency(settlement.pg_fee)}</td
                                    >
                                    <td class="py-4 text-red-500"
                                        >-{formatCurrency(settlement.platform_fee)}</td
                                    >
                                    <td class="py-4 font-bold"
                                        >{formatCurrency(settlement.net_amount)}</td
                                    >
                                    <td class="py-4">
                                        <Badge variant={getStatusBadgeVariant(settlement.status)}>
                                            {getStatusLabel(settlement.status)}
                                        </Badge>
                                    </td>
                                    <td class="py-4">
                                        {#if settlement.status === 'pending'}
                                            <Button size="sm">정산 처리</Button>
                                        {:else if settlement.status === 'completed' && settlement.processed_at}
                                            <span class="text-muted-foreground text-sm">
                                                {formatDate(settlement.processed_at)}
                                            </span>
                                        {:else}
                                            <span class="text-muted-foreground text-sm">-</span>
                                        {/if}
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
