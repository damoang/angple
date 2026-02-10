<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import type { FreePost } from '$lib/api/types.js';
	import GivingCardLayout from '$lib/components/features/board/layouts/list/giving-card.svelte';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import Pencil from '@lucide/svelte/icons/pencil';
	import { DamoangBanner } from '$lib/components/ui/damoang-banner/index.js';
	import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
	import { SeoHead, createBreadcrumbJsonLd } from '$lib/seo/index.js';
	import type { SeoConfig } from '$lib/seo/types.js';

	interface GivingBoardData {
		boardId: string;
		board?: import('$lib/api/types.js').Board;
		posts: FreePost[];
		notices?: FreePost[];
		pagination: {
			page: number;
			total: number;
			totalPages: number;
		};
		error?: string;
	}

	let { data }: { data: GivingBoardData } = $props();

	const boardId = $derived(data.boardId);
	const boardTitle = $derived(data.board?.subject || '나눔');

	// 탭 상태
	const activeTab = $derived($page.url.searchParams.get('tab') || 'active');

	// 정렬 상태
	const sortBy = $derived($page.url.searchParams.get('sort') || 'urgent');

	// 글쓰기 권한
	const canWrite = $derived(() => {
		if (!authStore.isAuthenticated) return false;
		if (data.board?.permissions) return data.board.permissions.can_write;
		const userLevel = authStore.user?.mb_level ?? 1;
		const requiredLevel = data.board?.write_level ?? 1;
		return userLevel >= requiredLevel;
	});

	function changeTab(tab: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('tab', tab);
		url.searchParams.set('page', '1');
		goto(url.pathname + url.search);
	}

	function changeSort(sort: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('sort', sort);
		url.searchParams.set('page', '1');
		goto(url.pathname + url.search);
	}

	function goToPost(id: number) {
		goto(`/${boardId}/${id}`);
	}

	function goToWrite() {
		goto(`/${boardId}/write`);
	}

	function goToPage(pageNum: number) {
		const url = new URL(window.location.href);
		url.searchParams.set('page', String(pageNum));
		goto(url.pathname + url.search);
	}

	// SEO
	const seoConfig: SeoConfig = $derived({
		meta: {
			title: `${boardTitle} - ${activeTab === 'active' ? '진행중' : '종료'}`,
			description: `${boardTitle} 게시판 - 다모앙 커뮤니티`,
			canonicalUrl: `${$page.url.origin}/${boardId}`
		},
		og: {
			title: boardTitle,
			type: 'website',
			url: `${$page.url.origin}/${boardId}`
		},
		jsonLd: [
			createBreadcrumbJsonLd([
				{ name: '홈', url: $page.url.origin },
				{ name: boardTitle, url: `${$page.url.origin}/${boardId}` }
			])
		]
	});
</script>

<SeoHead config={seoConfig} />

<div class="mx-auto pt-4">
	<!-- 헤더 -->
	<div class="mb-4 flex items-start justify-between">
		<h1 class="text-foreground text-xl font-bold sm:text-3xl">{boardTitle}</h1>
		{#if canWrite()}
			<Button onclick={goToWrite} class="shrink-0">
				<Pencil class="mr-2 h-4 w-4" />
				글쓰기
			</Button>
		{/if}
	</div>

	<!-- 광고 -->
	<div class="mb-4">
		<DamoangBanner position="board-list" showCelebration={false} height="90px" />
	</div>

	<!-- 탭 + 정렬 -->
	<div class="mb-4 flex items-center justify-between">
		<div class="flex gap-2">
			<Button
				variant={activeTab === 'active' ? 'default' : 'outline'}
				size="sm"
				onclick={() => changeTab('active')}
			>
				진행중
			</Button>
			<Button
				variant={activeTab === 'ended' ? 'default' : 'outline'}
				size="sm"
				onclick={() => changeTab('ended')}
			>
				종료
			</Button>
		</div>

		{#if activeTab === 'active'}
			<div class="flex gap-1">
				<Badge
					variant={sortBy === 'urgent' ? 'default' : 'outline'}
					class="cursor-pointer"
					onclick={() => changeSort('urgent')}
				>
					긴급순
				</Badge>
				<Badge
					variant={sortBy === 'newest' ? 'default' : 'outline'}
					class="cursor-pointer"
					onclick={() => changeSort('newest')}
				>
					최신순
				</Badge>
			</div>
		{/if}
	</div>

	<!-- 광고 -->
	<div class="mb-4">
		<AdSlot position="board-head" height="90px" />
	</div>

	<!-- 에러 -->
	{#if data.error}
		<Card class="border-destructive mb-6">
			<CardContent class="pt-6">
				<p class="text-destructive text-center">{data.error}</p>
			</CardContent>
		</Card>
	{/if}

	<!-- 나눔 카드 그리드 -->
	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
		{#if data.posts.length === 0}
			<Card class="col-span-full bg-background">
				<CardContent class="py-12 text-center">
					<p class="text-secondary-foreground">
						{activeTab === 'active' ? '진행중인 나눔이 없습니다.' : '종료된 나눔이 없습니다.'}
					</p>
				</CardContent>
			</Card>
		{:else}
			{#each data.posts as post (post.id)}
				<GivingCardLayout
					{post}
					displaySettings={data.board?.display_settings}
					onclick={() => goToPost(post.id)}
				/>
			{/each}
		{/if}
	</div>

	<!-- 페이지네이션 -->
	{#if data.pagination.totalPages > 1}
		<div class="mt-8 flex items-center justify-center gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={data.pagination.page === 1}
				onclick={() => goToPage(data.pagination.page - 1)}
			>
				이전
			</Button>

			{#each Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
				const startPage = Math.max(1, data.pagination.page - 2);
				return startPage + i;
			}) as pageNum (pageNum)}
				{#if pageNum <= data.pagination.totalPages}
					<Button
						variant={pageNum === data.pagination.page ? 'default' : 'outline'}
						size="sm"
						onclick={() => goToPage(pageNum)}
					>
						{pageNum}
					</Button>
				{/if}
			{/each}

			<Button
				variant="outline"
				size="sm"
				disabled={data.pagination.page === data.pagination.totalPages}
				onclick={() => goToPage(data.pagination.page + 1)}
			>
				다음
			</Button>
		</div>

		<p class="text-secondary-foreground mt-4 text-center text-sm">
			전체 {data.pagination.total.toLocaleString()}개 중 {data.pagination.page} / {data.pagination
				.totalPages} 페이지
		</p>
	{/if}

	<!-- 하단 광고 -->
	<div class="mt-6">
		<AdSlot position="board-list-bottom" height="90px" />
	</div>
</div>
