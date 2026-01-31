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
        Star,
        Check,
        X,
        Trash2,
        ArrowLeft,
        ChevronLeft,
        ChevronRight,
        ThumbsUp
    } from '@lucide/svelte';
    import { type Review, formatDate } from '$lib/api/admin-commerce';

    let reviews = $state<Review[]>([]);
    let isLoading = $state(true);
    let statusFilter = $state<string>('all');
    let currentPage = $state(1);
    let totalPages = $state(1);

    // Mock 데이터
    const mockReviews: Review[] = [
        {
            id: 1,
            product_id: 1,
            user_id: 1,
            order_item_id: 1,
            rating: 5,
            title: '정말 좋은 강좌입니다!',
            content:
                '설명이 자세하고 쉽게 이해할 수 있었습니다. 초보자에게 강력 추천합니다. 가격 대비 정말 만족스럽습니다.',
            helpful_count: 23,
            status: 'approved',
            created_at: '2026-01-28T10:30:00Z',
            updated_at: '2026-01-28T10:30:00Z',
            product: {
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
            }
        },
        {
            id: 2,
            product_id: 2,
            user_id: 2,
            order_item_id: 2,
            rating: 4,
            title: '배송이 빨랐어요',
            content: '굿즈 품질이 좋고 배송도 빨랐습니다. 다만 포장이 조금 아쉬웠어요.',
            helpful_count: 5,
            seller_reply: '소중한 리뷰 감사합니다. 포장 관련 피드백 반영하겠습니다.',
            seller_reply_at: '2026-01-27T15:00:00Z',
            status: 'approved',
            created_at: '2026-01-26T14:20:00Z',
            updated_at: '2026-01-27T15:00:00Z',
            product: {
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
        },
        {
            id: 3,
            product_id: 1,
            user_id: 3,
            order_item_id: 3,
            rating: 2,
            title: '기대에 못 미침',
            content: '광고와 다르게 내용이 부실합니다. 환불 요청합니다.',
            helpful_count: 1,
            status: 'pending',
            created_at: '2026-01-29T08:00:00Z',
            updated_at: '2026-01-29T08:00:00Z',
            product: {
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
            }
        }
    ];

    onMount(async () => {
        try {
            await new Promise((resolve) => setTimeout(resolve, 500));
            reviews = mockReviews;
            totalPages = 2;
        } finally {
            isLoading = false;
        }
    });

    function getStatusBadgeVariant(status: string) {
        switch (status) {
            case 'approved':
                return 'default';
            case 'pending':
                return 'secondary';
            case 'rejected':
                return 'destructive';
            default:
                return 'outline';
        }
    }

    function getStatusLabel(status: string) {
        const labels: Record<string, string> = {
            pending: '검토 대기',
            approved: '승인됨',
            rejected: '거부됨'
        };
        return labels[status] || status;
    }

    function renderStars(rating: number) {
        return Array(5)
            .fill(0)
            .map((_, i) => i < rating);
    }

    const filteredReviews = $derived(
        reviews.filter((r) => {
            return statusFilter === 'all' || r.status === statusFilter;
        })
    );

    function approveReview(id: number) {
        const review = reviews.find((r) => r.id === id);
        if (review) {
            review.status = 'approved';
            reviews = [...reviews];
        }
    }

    function rejectReview(id: number) {
        const review = reviews.find((r) => r.id === id);
        if (review) {
            review.status = 'rejected';
            reviews = [...reviews];
        }
    }

    function deleteReview(id: number) {
        if (confirm('이 리뷰를 삭제하시겠습니까?')) {
            reviews = reviews.filter((r) => r.id !== id);
        }
    }
</script>

<div class="container mx-auto p-8">
    <!-- 페이지 헤더 -->
    <div class="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/admin/commerce">
            <ArrowLeft class="h-4 w-4" />
        </Button>
        <div>
            <h1 class="text-4xl font-bold">리뷰 관리</h1>
            <p class="text-muted-foreground mt-2">상품 리뷰를 관리합니다.</p>
        </div>
    </div>

    <!-- 요약 카드 -->
    <div class="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">검토 대기</CardTitle>
                <Star class="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">
                    {reviews.filter((r) => r.status === 'pending').length}
                </div>
                <p class="text-muted-foreground text-xs">승인 대기 중인 리뷰</p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">승인된 리뷰</CardTitle>
                <Check class="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">
                    {reviews.filter((r) => r.status === 'approved').length}
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle class="text-sm font-medium">평균 평점</CardTitle>
                <Star class="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
                <div class="text-2xl font-bold">
                    {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0).toFixed(
                        1
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
                    <option value="pending">검토 대기</option>
                    <option value="approved">승인됨</option>
                    <option value="rejected">거부됨</option>
                </select>
            </div>
        </CardContent>
    </Card>

    <!-- 리뷰 목록 -->
    {#if isLoading}
        <div class="flex h-64 items-center justify-center">
            <div class="text-muted-foreground">로딩 중...</div>
        </div>
    {:else if filteredReviews.length === 0}
        <Card>
            <CardContent class="py-12 text-center">
                <Star class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">리뷰가 없습니다</h2>
                <p class="text-muted-foreground">검색 조건에 맞는 리뷰가 없습니다.</p>
            </CardContent>
        </Card>
    {:else}
        <div class="space-y-4">
            {#each filteredReviews as review (review.id)}
                <Card>
                    <CardContent class="pt-6">
                        <div class="flex gap-4">
                            <!-- 리뷰 내용 -->
                            <div class="flex-1">
                                <div class="mb-2 flex items-center gap-2">
                                    <!-- 별점 -->
                                    <div class="flex">
                                        {#each renderStars(review.rating) as filled}
                                            <Star
                                                class="h-4 w-4 {filled
                                                    ? 'fill-yellow-400 text-yellow-400'
                                                    : 'text-gray-300'}"
                                            />
                                        {/each}
                                    </div>
                                    <Badge variant={getStatusBadgeVariant(review.status)}>
                                        {getStatusLabel(review.status)}
                                    </Badge>
                                    <span class="text-muted-foreground text-sm">
                                        {formatDate(review.created_at)}
                                    </span>
                                </div>

                                <h3 class="mb-1 font-semibold">{review.title}</h3>
                                <p class="text-muted-foreground mb-2">{review.content}</p>

                                <!-- 상품 정보 -->
                                {#if review.product}
                                    <div class="text-muted-foreground text-sm">
                                        상품: {review.product.name}
                                    </div>
                                {/if}

                                <!-- 도움이 됨 카운트 -->
                                <div
                                    class="text-muted-foreground mt-2 flex items-center gap-1 text-sm"
                                >
                                    <ThumbsUp class="h-3 w-3" />
                                    {review.helpful_count}명에게 도움이 됨
                                </div>

                                <!-- 판매자 답글 -->
                                {#if review.seller_reply}
                                    <div class="bg-muted mt-3 rounded-lg p-3">
                                        <div class="mb-1 text-sm font-medium">판매자 답글</div>
                                        <p class="text-muted-foreground text-sm">
                                            {review.seller_reply}
                                        </p>
                                        {#if review.seller_reply_at}
                                            <div class="text-muted-foreground mt-1 text-xs">
                                                {formatDate(review.seller_reply_at)}
                                            </div>
                                        {/if}
                                    </div>
                                {/if}
                            </div>

                            <!-- 액션 버튼 -->
                            <div class="flex flex-col gap-2">
                                {#if review.status === 'pending'}
                                    <Button
                                        size="sm"
                                        variant="default"
                                        onclick={() => approveReview(review.id)}
                                    >
                                        <Check class="mr-1 h-4 w-4" />
                                        승인
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onclick={() => rejectReview(review.id)}
                                    >
                                        <X class="mr-1 h-4 w-4" />
                                        거부
                                    </Button>
                                {/if}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onclick={() => deleteReview(review.id)}
                                >
                                    <Trash2 class="mr-1 h-4 w-4" />
                                    삭제
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            {/each}
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
    {/if}
</div>
