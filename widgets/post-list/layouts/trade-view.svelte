<script lang="ts">
    /**
     * 거래 게시판 레이아웃
     *
     * 중고거래/판매 게시글을 카드 형태로 표시합니다.
     * - 가격 표시 (원가, 할인가)
     * - 거래 상태 (판매중, 예약중, 판매완료)
     * - 거래 방식 (직거래, 택배)
     * - 지역 정보
     * - 찜/좋아요 카운트
     *
     * Design System: "Soft Modern" - 깔끔한 상품 카드, 가격 강조
     */
    import { Card } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
    import MapPin from '@lucide/svelte/icons/map-pin';
    import Heart from '@lucide/svelte/icons/heart';
    import Truck from '@lucide/svelte/icons/truck';
    import UserCircle from '@lucide/svelte/icons/user-circle';
    import Clock from '@lucide/svelte/icons/clock';
    import CheckCircle from '@lucide/svelte/icons/check-circle';
    import Tag from '@lucide/svelte/icons/tag';

    interface TradePost {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: {
            id?: string;
            nickname?: string;
            avatar_url?: string;
        };
        price?: number;
        original_price?: number;
        status?: 'selling' | 'reserved' | 'sold';
        trade_type?: 'direct' | 'shipping' | 'both';
        location?: string;
        like_count?: number;
        view_count?: number;
        comment_count?: number;
        created_at?: string;
        is_free?: boolean;
        is_negotiable?: boolean;
    }

    let {
        posts = [],
        showTitle = true,
        boardId = ''
    }: {
        posts: TradePost[];
        showTitle?: boolean;
        boardId?: string;
    } = $props();

    // 거래 상태 스타일
    const statusStyles: Record<string, { text: string; class: string; icon: typeof Tag }> = {
        selling: {
            text: '판매중',
            class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400',
            icon: Tag
        },
        reserved: {
            text: '예약중',
            class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
            icon: Clock
        },
        sold: {
            text: '판매완료',
            class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
            icon: CheckCircle
        }
    };

    // 거래 방식 텍스트
    const tradeTypeLabels: Record<string, string> = {
        direct: '직거래',
        shipping: '택배',
        both: '직거래/택배'
    };

    // 가격 포맷
    function formatPrice(price?: number): string {
        if (price === undefined || price === null) return '';
        if (price === 0) return '무료나눔';
        return price.toLocaleString() + '원';
    }

    // 날짜 포맷
    function formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffM = Math.floor(diffMs / (1000 * 60));
        const diffH = Math.floor(diffMs / (1000 * 60 * 60));
        const diffD = Math.floor(diffH / 24);

        if (diffM < 1) return '방금 전';
        if (diffM < 60) return `${diffM}분 전`;
        if (diffH < 24) return `${diffH}시간 전`;
        if (diffD < 7) return `${diffD}일 전`;
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }

    // 할인율 계산
    function getDiscountPercent(original?: number, current?: number): number | null {
        if (!original || !current || original <= current) return null;
        return Math.round(((original - current) / original) * 100);
    }

    // 상태별 분류
    const sellingPosts = $derived(
        posts.filter((p) => !p.status || p.status === 'selling' || p.status === 'reserved')
    );
    const soldPosts = $derived(posts.filter((p) => p.status === 'sold'));
</script>

<Card class="gap-0 overflow-hidden">
    {#if showTitle}
        <div class="border-border flex items-center justify-between border-b px-4 py-2.5">
            <div class="flex items-center gap-2">
                <ShoppingBag class="text-primary h-4 w-4" />
                <h3 class="text-sm font-semibold">거래</h3>
            </div>
            <span class="text-muted-foreground text-xs">
                {posts.length}개의 상품
            </span>
        </div>
    {/if}

    {#if posts.length === 0}
        <!-- 빈 상태 -->
        <div class="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingBag class="text-muted-foreground/40 mb-3 h-12 w-12" />
            <p class="text-foreground text-lg font-medium">등록된 상품이 없습니다</p>
            <p class="text-muted-foreground mt-1 text-sm">첫 번째 상품을 등록해보세요!</p>
        </div>
    {:else}
        <div class="p-4">
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {#each posts as post (post.id)}
                    {@const status = statusStyles[post.status ?? 'selling']}
                    {@const discount = getDiscountPercent(post.original_price, post.price)}
                    {@const isSold = post.status === 'sold'}
                    <a
                        href={post.url ?? '#'}
                        class="border-border bg-background group flex flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md {isSold
                            ? 'opacity-60'
                            : ''}"
                    >
                        <!-- 썸네일 -->
                        <div class="bg-muted relative aspect-square overflow-hidden">
                            {#if post.thumbnail_url}
                                <img
                                    src={post.thumbnail_url}
                                    alt={post.title}
                                    class="h-full w-full object-cover transition-transform duration-300 {isSold
                                        ? 'grayscale'
                                        : 'group-hover:scale-105'}"
                                    loading="lazy"
                                />
                            {:else}
                                <div
                                    class="text-muted-foreground flex h-full w-full items-center justify-center"
                                >
                                    <ShoppingBag class="h-16 w-16 opacity-20" />
                                </div>
                            {/if}

                            <!-- 상태 뱃지 (판매중이 아닌 경우만) -->
                            {#if post.status && post.status !== 'selling'}
                                <div class="absolute left-2 top-2">
                                    <span
                                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold {status.class}"
                                    >
                                        <svelte:component this={status.icon} class="h-3 w-3" />
                                        {status.text}
                                    </span>
                                </div>
                            {/if}

                            <!-- 할인율 뱃지 -->
                            {#if discount && !isSold}
                                <div class="absolute right-2 top-2">
                                    <span
                                        class="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white"
                                    >
                                        {discount}%
                                    </span>
                                </div>
                            {/if}

                            <!-- 찜 아이콘 (호버시) -->
                            <div
                                class="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                                <button
                                    type="button"
                                    class="text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:text-rose-500 dark:bg-gray-800/90"
                                    onclick={(e) => e.preventDefault()}
                                >
                                    <Heart class="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <!-- 콘텐츠 -->
                        <div class="flex flex-1 flex-col p-3">
                            <!-- 제목 -->
                            <h4
                                class="text-foreground line-clamp-2 text-sm font-medium leading-snug"
                            >
                                {post.title}
                            </h4>

                            <!-- 가격 -->
                            <div class="mt-2">
                                {#if post.is_free || post.price === 0}
                                    <span class="text-base font-bold text-emerald-600"
                                        >무료나눔</span
                                    >
                                {:else}
                                    <div class="flex flex-wrap items-baseline gap-1">
                                        <span class="text-foreground text-base font-bold">
                                            {formatPrice(post.price)}
                                        </span>
                                        {#if post.original_price && post.original_price > (post.price ?? 0)}
                                            <span
                                                class="text-muted-foreground text-xs line-through"
                                            >
                                                {formatPrice(post.original_price)}
                                            </span>
                                        {/if}
                                    </div>
                                    {#if post.is_negotiable}
                                        <span class="text-muted-foreground text-xs"
                                            >가격제안 가능</span
                                        >
                                    {/if}
                                {/if}
                            </div>

                            <!-- 메타 정보 -->
                            <div
                                class="text-muted-foreground mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-xs"
                            >
                                {#if post.location}
                                    <span class="inline-flex items-center gap-0.5">
                                        <MapPin class="h-3 w-3" />
                                        {post.location}
                                    </span>
                                {/if}
                                {#if post.trade_type}
                                    <span class="inline-flex items-center gap-0.5">
                                        {#if post.trade_type === 'shipping' || post.trade_type === 'both'}
                                            <Truck class="h-3 w-3" />
                                        {:else}
                                            <UserCircle class="h-3 w-3" />
                                        {/if}
                                        {tradeTypeLabels[post.trade_type]}
                                    </span>
                                {/if}
                            </div>

                            <!-- 하단: 찜/시간 -->
                            <div
                                class="border-border text-muted-foreground mt-2 flex items-center justify-between border-t pt-2 text-xs"
                            >
                                <div class="flex items-center gap-2">
                                    {#if post.like_count}
                                        <span class="inline-flex items-center gap-0.5">
                                            <Heart class="h-3 w-3" />
                                            {post.like_count}
                                        </span>
                                    {/if}
                                    {#if post.comment_count}
                                        <span>댓글 {post.comment_count}</span>
                                    {/if}
                                </div>
                                {#if post.created_at}
                                    <span>{formatDate(post.created_at)}</span>
                                {/if}
                            </div>
                        </div>
                    </a>
                {/each}
            </div>
        </div>
    {/if}
</Card>
