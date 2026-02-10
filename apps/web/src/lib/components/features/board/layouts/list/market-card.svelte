<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
	import { parseMarketInfo, formatPrice, MARKET_STATUS_LABELS, type MarketStatus } from '$lib/types/used-market.js';
	import ImageIcon from '@lucide/svelte/icons/image';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Truck from '@lucide/svelte/icons/truck';
	import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
	import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';

	let {
		post,
		displaySettings,
		onclick
	}: {
		post: FreePost;
		displaySettings?: BoardDisplaySettings;
		onclick: () => void;
	} = $props();

	const market = $derived(parseMarketInfo(post));
	const thumbnailUrl = $derived(post.thumbnail || post.images?.[0] || '');
	const hasImage = $derived(Boolean(thumbnailUrl));
	const isSold = $derived(market.status === 'sold');

	// 상태 배지 스타일
	const statusBadge = $derived(() => {
		const s = market.status;
		switch (s) {
			case 'selling':
				return { label: '판매중', class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' };
			case 'reserved':
				return { label: '예약중', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' };
			case 'sold':
				return { label: '판매완료', class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
			default:
				return { label: MARKET_STATUS_LABELS[s as MarketStatus] || s, class: 'bg-gray-100 text-gray-600' };
		}
	});

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days > 7) {
			return `${date.getMonth() + 1}/${date.getDate()}`;
		} else if (days > 0) {
			return `${days}일 전`;
		}
		const hours = Math.floor(diff / (1000 * 60 * 60));
		if (hours > 0) return `${hours}시간 전`;
		const minutes = Math.floor(diff / (1000 * 60));
		if (minutes > 0) return `${minutes}분 전`;
		return '방금 전';
	}
</script>

<!-- 마켓 카드 레이아웃 -->
<div
	class="bg-background border-border hover:border-primary/30 group cursor-pointer overflow-hidden rounded-lg border transition-all hover:shadow-md {isSold ? 'opacity-60' : ''}"
	{onclick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && onclick()}
>
	<!-- 상품 이미지 (1:1 비율) -->
	<div class="bg-muted relative aspect-square overflow-hidden">
		{#if hasImage}
			<img
				src={thumbnailUrl}
				alt=""
				class="h-full w-full object-cover transition-transform group-hover:scale-105"
				loading="lazy"
				onerror={(e) => {
					const target = e.target as HTMLImageElement;
					target.style.display = 'none';
				}}
			/>
		{:else}
			<div class="flex h-full items-center justify-center">
				<ImageIcon class="text-muted-foreground h-10 w-10" />
			</div>
		{/if}

		<!-- 상태 배지 (좌상단) -->
		<div class="absolute left-2 top-2">
			<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusBadge().class}">
				{statusBadge().label}
			</span>
		</div>

		<!-- 택배 가능 아이콘 (우상단) -->
		{#if market.shippingAvailable}
			<div class="absolute right-2 top-2">
				<span class="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300" title="택배 가능">
					<Truck class="h-3 w-3" />
				</span>
			</div>
		{/if}
	</div>

	<!-- 상품 정보 -->
	<div class="p-3">
		<h3 class="text-foreground mb-1 truncate text-sm font-medium {isSold ? 'line-through' : ''}">
			{post.title}
		</h3>

		<!-- 가격 -->
		<div class="mb-1.5">
			<span class="text-foreground text-base font-bold {market.price === 0 ? 'text-green-600 dark:text-green-400' : ''}">
				{formatPrice(market.price)}
			</span>
		</div>

		<!-- 위치 + 시간 -->
		<div class="text-muted-foreground flex items-center gap-1.5 text-xs">
			{#if market.location}
				<span class="inline-flex items-center gap-0.5">
					<MapPin class="h-3 w-3" />
					{market.location}
				</span>
				<span>·</span>
			{/if}
			<span>{formatDate(post.created_at)}</span>
		</div>

		<!-- 작성자 + 댓글/좋아요 -->
		<div class="text-muted-foreground mt-1.5 flex items-center justify-between text-xs">
			<span class="inline-flex items-center gap-0.5">
				<LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="sm" />
				{post.author}
			</span>
			<div class="flex gap-2">
				{#if post.likes > 0}
					<span>👍 {post.likes}</span>
				{/if}
				{#if post.comments_count > 0}
					<span>💬 {post.comments_count}</span>
				{/if}
			</div>
		</div>
	</div>
</div>
