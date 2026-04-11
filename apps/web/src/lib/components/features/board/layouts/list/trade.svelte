<script lang="ts">
    /**
     * 거래 게시판 레이아웃
     *
     * 중고거래/판매 게시글을 카드 형태로 표시합니다.
     * - 가격 표시
     * - 거래 상태 (판매중, 예약중, 판매완료)
     * - 거래 방식 (택배 가능 여부)
     * - 지역 정보
     * - 찜/좋아요 카운트
     *
     * Design System: "Soft Modern" - 깔끔한 상품 카드, 가격 강조
     *
     * 확장 필드 매핑 (used-market.ts 기준):
     * - extra_1: 가격
     * - extra_2: 상태 (selling/reserved/sold)
     * - extra_4: 위치
     * - extra_5: 택배 가능 여부 (1 = true)
     */
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import { parseMarketInfo, formatPrice, type MarketStatus } from '$lib/types/used-market.js';
    import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
    import MapPin from '@lucide/svelte/icons/map-pin';
    import Heart from '@lucide/svelte/icons/heart';
    import Truck from '@lucide/svelte/icons/truck';
    import Clock from '@lucide/svelte/icons/clock';
    import CheckCircle from '@lucide/svelte/icons/check-circle';
    import Tag from '@lucide/svelte/icons/tag';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import { toThumbnailUrl } from '$lib/utils/thumbnail-url.js';
    let {
        post,
        displaySettings,
        href,
        isRead = false
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
        isRead?: boolean;
    } = $props();

    // 삭제된 글
    const isDeleted = $derived(!!post.deleted_at);

    // 썸네일 표시 (원본 대신 400x225.webp 로드 → 대역폭 절감)
    const rawThumbnailUrl = $derived(
        post.thumbnail_raw || post.thumbnail || post.images?.[0] || ''
    );
    const thumbnailUrl = $derived(toThumbnailUrl(rawThumbnailUrl, '400x225'));
    const hasImage = $derived(Boolean(rawThumbnailUrl));

    // 중고 마켓 정보 파싱
    const market = $derived(parseMarketInfo(post));
    const isSold = $derived(market.status === 'sold');

    // 거래 상태 스타일
    const statusStyles: Record<MarketStatus, { text: string; class: string; icon: typeof Tag }> = {
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

    const statusInfo = $derived(statusStyles[market.status] ?? statusStyles.selling);

    // 날짜 포맷
    function formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const nowDate = new Date();
        const diffMs = nowDate.getTime() - date.getTime();
        const diffM = Math.floor(diffMs / (1000 * 60));
        const diffH = Math.floor(diffMs / (1000 * 60 * 60));
        const diffD = Math.floor(diffH / 24);

        if (diffM < 1) return '방금 전';
        if (diffM < 60) return `${diffM}분 전`;
        if (diffH < 24) return `${diffH}시간 전`;
        if (diffD < 7) return `${diffD}일 전`;
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
</script>

<!-- 거래 카드 -->
{#if isDeleted}
    <a
        {href}
        class="border-border bg-background flex cursor-pointer flex-col overflow-hidden rounded-xl border no-underline opacity-50 transition-shadow hover:shadow-md"
    >
        <div class="bg-muted flex aspect-square items-center justify-center">
            <span class="text-muted-foreground text-sm">[삭제됨]</span>
        </div>
    </a>
{:else}
    <a
        {href}
        class="border-border bg-background group flex flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md {isSold
            ? 'opacity-60'
            : ''}"
    >
        <!-- 썸네일 -->
        <div class="bg-muted relative aspect-square overflow-hidden">
            {#if hasImage}
                <img
                    src={thumbnailUrl}
                    alt={post.title}
                    class="h-full w-full object-cover transition-transform duration-300 {isSold
                        ? 'grayscale'
                        : 'group-hover:scale-105'}"
                    loading="lazy"
                    decoding="async"
                    onerror={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (rawThumbnailUrl && target.src !== rawThumbnailUrl) {
                            target.src = rawThumbnailUrl;
                        } else {
                            target.style.display = 'none';
                        }
                    }}
                />
            {:else}
                <div class="text-muted-foreground flex h-full w-full items-center justify-center">
                    <ShoppingBag class="h-16 w-16 opacity-20" />
                </div>
            {/if}

            <!-- 상태 뱃지 (판매중이 아닌 경우만) -->
            {#if market.status === 'reserved'}
                <div class="absolute left-2 top-2">
                    <span
                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold {statusInfo.class}"
                    >
                        <Clock class="h-3 w-3" />
                        {statusInfo.text}
                    </span>
                </div>
            {:else if market.status === 'sold'}
                <div class="absolute left-2 top-2">
                    <span
                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold {statusInfo.class}"
                    >
                        <CheckCircle class="h-3 w-3" />
                        {statusInfo.text}
                    </span>
                </div>
            {/if}

            <!-- 택배 가능 뱃지 -->
            {#if market.shippingAvailable}
                <div class="absolute right-2 top-2">
                    <span
                        class="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        title="택배 가능"
                    >
                        <Truck class="h-3 w-3" />
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
                    onclick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <Heart class="h-4 w-4" />
                </button>
            </div>
        </div>

        <!-- 콘텐츠 -->
        <div class="flex flex-1 flex-col p-3">
            <!-- 제목 -->
            <h4
                class="line-clamp-2 text-sm font-medium leading-snug {isRead
                    ? 'text-muted-foreground'
                    : 'text-foreground'}"
            >
                {post.title}
            </h4>

            <!-- 가격 + 배지 -->
            <div class="mt-2">
                <span
                    class="text-base font-bold {market.price === 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-foreground'}"
                >
                    {formatPrice(market.price)}
                </span>
                {#if market.isNegotiable && market.price > 0}
                    <span class="text-muted-foreground ml-1 text-xs">협상가능</span>
                {/if}
            </div>
            {#if market.condition && market.condition !== 'good'}
                <span class="text-muted-foreground mt-1 text-xs">
                    {market.condition === 'new'
                        ? '새상품'
                        : market.condition === 'like-new'
                          ? '거의 새것'
                          : '많이 사용함'}
                </span>
            {/if}

            <!-- 메타 정보 -->
            <div
                class="text-muted-foreground mt-auto flex flex-wrap items-center gap-1.5 pt-2 text-xs"
            >
                {#if market.location}
                    <span class="inline-flex items-center gap-0.5">
                        <MapPin class="h-3 w-3" />
                        {market.location}
                    </span>
                {/if}
            </div>

            <!-- 하단: 좋아요/댓글/시간 -->
            <div
                class="border-border text-muted-foreground mt-2 flex items-center justify-between border-t pt-2 text-xs"
            >
                <div class="flex items-center gap-2">
                    {#if post.likes > 0}
                        <span class="inline-flex items-center gap-0.5">
                            <Heart class="h-3 w-3" />
                            {post.likes}
                        </span>
                    {/if}
                    {#if post.comments_count > 0}
                        <span class="inline-flex items-center gap-0.5">
                            <MessageSquare class="h-3 w-3" />
                            {post.comments_count}
                        </span>
                    {/if}
                </div>
                <span>{formatDate(post.created_at)}</span>
            </div>
        </div>
    </a>
{/if}
