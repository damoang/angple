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
        Package,
        Search,
        Filter,
        Eye,
        Edit,
        ArrowLeft,
        ChevronLeft,
        ChevronRight
    } from '@lucide/svelte';
    import { type Product, formatCurrency, formatDate } from '$lib/api/admin-commerce';

    let products = $state<Product[]>([]);
    let isLoading = $state(true);
    let searchQuery = $state('');
    let statusFilter = $state<string>('all');
    let currentPage = $state(1);
    let totalPages = $state(1);

    // Mock 데이터
    const mockProducts: Product[] = [
        {
            id: 1,
            seller_id: 1,
            name: '프리미엄 디지털 강좌',
            slug: 'premium-digital-course',
            description: '최고의 디지털 강좌입니다.',
            short_desc: '프리미엄 강좌',
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
            description: '한정판 굿즈 세트입니다.',
            short_desc: '한정판 굿즈',
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
        },
        {
            id: 3,
            seller_id: 2,
            name: '이북 - 프로그래밍 입문',
            slug: 'ebook-programming',
            description: '프로그래밍 입문 이북입니다.',
            short_desc: '프로그래밍 이북',
            product_type: 'digital',
            price: 15000,
            currency: 'KRW',
            stock_status: 'in_stock',
            status: 'draft',
            visibility: 'private',
            featured_image: '',
            sales_count: 0,
            view_count: 120,
            created_at: '2026-01-15T00:00:00Z',
            updated_at: '2026-01-28T00:00:00Z'
        }
    ];

    onMount(async () => {
        try {
            // TODO: 실제 API 연동
            await new Promise((resolve) => setTimeout(resolve, 500));
            products = mockProducts;
            totalPages = 5;
        } finally {
            isLoading = false;
        }
    });

    function getStatusBadgeVariant(status: string) {
        switch (status) {
            case 'published':
                return 'default';
            case 'draft':
                return 'secondary';
            case 'archived':
                return 'destructive';
            default:
                return 'outline';
        }
    }

    function getStatusLabel(status: string) {
        const labels: Record<string, string> = {
            published: '판매중',
            draft: '임시저장',
            archived: '판매중지'
        };
        return labels[status] || status;
    }

    const filteredProducts = $derived(
        products.filter((p) => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
    );
</script>

<div class="container mx-auto p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/admin/commerce">
            <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
            <h1 class="text-4xl font-bold">상품 관리</h1>
            <p class="text-muted-foreground mt-2">등록된 상품을 관리합니다.</p>
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
                        placeholder="상품명 검색..."
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
                        <option value="published">판매중</option>
                        <option value="draft">임시저장</option>
                        <option value="archived">판매중지</option>
                    </select>
                </div>
            </div>
        </CardContent>
    </Card>

    <!-- 상품 목록 -->
    {#if isLoading}
        <div class="flex h-64 items-center justify-center">
            <div class="text-muted-foreground">로딩 중...</div>
        </div>
    {:else if filteredProducts.length === 0}
        <Card>
            <CardContent class="py-12 text-center">
                <Package class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">상품이 없습니다</h2>
                <p class="text-muted-foreground">검색 조건에 맞는 상품이 없습니다.</p>
            </CardContent>
        </Card>
    {:else}
        <Card>
            <CardHeader>
                <CardTitle>상품 목록</CardTitle>
                <CardDescription>총 {filteredProducts.length}개의 상품</CardDescription>
            </CardHeader>
            <CardContent>
                <div class="overflow-x-auto">
                    <table class="w-full">
                        <thead>
                            <tr class="border-b text-left">
                                <th class="pb-3 font-medium">상품명</th>
                                <th class="pb-3 font-medium">유형</th>
                                <th class="pb-3 font-medium">가격</th>
                                <th class="pb-3 font-medium">재고</th>
                                <th class="pb-3 font-medium">판매량</th>
                                <th class="pb-3 font-medium">상태</th>
                                <th class="pb-3 font-medium">등록일</th>
                                <th class="pb-3 font-medium">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredProducts as product (product.id)}
                                <tr class="border-b last:border-0">
                                    <td class="py-4">
                                        <div class="font-medium">{product.name}</div>
                                        <div class="text-muted-foreground text-sm">
                                            {product.slug}
                                        </div>
                                    </td>
                                    <td class="py-4">
                                        <Badge variant="outline">
                                            {product.product_type === 'digital' ? '디지털' : '실물'}
                                        </Badge>
                                    </td>
                                    <td class="py-4">{formatCurrency(product.price)}</td>
                                    <td class="py-4">
                                        {#if product.product_type === 'physical'}
                                            {product.stock_quantity ?? '-'}
                                        {:else}
                                            무제한
                                        {/if}
                                    </td>
                                    <td class="py-4">{product.sales_count.toLocaleString()}</td>
                                    <td class="py-4">
                                        <Badge variant={getStatusBadgeVariant(product.status)}>
                                            {getStatusLabel(product.status)}
                                        </Badge>
                                    </td>
                                    <td class="py-4 text-sm"
                                        >{formatDate(product.created_at).split(' ')[0]}</td
                                    >
                                    <td class="py-4">
                                        <div class="flex gap-1">
                                            <Button variant="ghost" size="icon" title="보기">
                                                <Eye class="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" title="수정">
                                                <Edit class="h-4 w-4" />
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
