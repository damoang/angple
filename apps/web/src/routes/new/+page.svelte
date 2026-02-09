<script lang="ts">
	import { goto } from '$app/navigation';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import Newspaper from '@lucide/svelte/icons/newspaper';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Eye from '@lucide/svelte/icons/eye';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	// 필터 옵션
	const viewOptions = [
		{ value: '', label: '전체' },
		{ value: 'w', label: '글만' },
		{ value: 'c', label: '댓글만' }
	];

	const selectedViewLabel = $derived(
		viewOptions.find((o) => o.value === data.currentView)?.label || '전체'
	);

	const selectedGroupLabel = $derived(
		data.currentGroup
			? data.groups.find((g) => g.gr_id === data.currentGroup)?.gr_subject || data.currentGroup
			: '전체 그룹'
	);

	// 필터 변경
	function updateFilter(key: string, value: string): void {
		const url = new URL(window.location.href);
		if (value) {
			url.searchParams.set(key, value);
		} else {
			url.searchParams.delete(key);
		}
		url.searchParams.set('page', '1');
		goto(url.pathname + url.search);
	}

	// 페이지 이동
	function goToPage(pageNum: number): void {
		const url = new URL(window.location.href);
		url.searchParams.set('page', String(pageNum));
		goto(url.pathname + url.search);
	}

	// 시간 포맷
	function formatTime(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		const minutes = Math.floor(diff / 60000);
		if (minutes < 1) return '방금 전';
		if (minutes < 60) return `${minutes}분 전`;

		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}시간 전`;

		return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
	}

	// 댓글인지 여부
	function isComment(item: { wr_id: number; wr_parent: number }): boolean {
		return item.wr_id !== item.wr_parent;
	}
</script>

<svelte:head>
	<title>새글 모아보기 | 다모앙</title>
	<meta name="description" content="다모앙 커뮤니티 최신 글과 댓글을 한눈에 확인하세요." />
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
	<!-- 헤더 -->
	<div class="mb-6">
		<div class="flex items-center gap-3">
			<Newspaper class="text-primary h-7 w-7" />
			<h1 class="text-foreground text-3xl font-bold">새글 모아보기</h1>
		</div>
		<p class="text-muted-foreground mt-1 text-sm">
			전체 {data.total.toLocaleString()}건
		</p>
	</div>

	<!-- 필터 -->
	<div class="mb-4 flex flex-wrap gap-2">
		<Select.Root
			type="single"
			value={data.currentView}
			onValueChange={(v) => updateFilter('view', v || '')}
		>
			<Select.Trigger class="w-[100px]">{selectedViewLabel}</Select.Trigger>
			<Select.Content>
				{#each viewOptions as opt (opt.value)}
					<Select.Item value={opt.value}>{opt.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<Select.Root
			type="single"
			value={data.currentGroup}
			onValueChange={(v) => updateFilter('gr_id', v || '')}
		>
			<Select.Trigger class="w-[140px]">{selectedGroupLabel}</Select.Trigger>
			<Select.Content>
				<Select.Item value="">전체 그룹</Select.Item>
				{#each data.groups as group (group.gr_id)}
					<Select.Item value={group.gr_id}>{group.gr_subject}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	</div>

	<!-- 게시글 목록 -->
	{#if data.items.length === 0}
		<Card class="bg-background">
			<CardContent class="py-12 text-center">
				<Newspaper class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
				<p class="text-muted-foreground">새 글이 없습니다.</p>
			</CardContent>
		</Card>
	{:else}
		<div class="space-y-1">
			{#each data.items as item (item.bn_id)}
				<a
					href={isComment(item) ? `/${item.bo_table}/${item.wr_parent}#c${item.wr_id}` : `/${item.bo_table}/${item.wr_id}`}
					class="hover:bg-accent flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
				>
					<!-- 게시판 뱃지 -->
					<Badge variant="secondary" class="shrink-0 text-xs">
						{item.bo_subject}
					</Badge>

					<!-- 제목 -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-1.5">
							{#if isComment(item)}
								<MessageSquare class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
							{/if}
							<span class="text-foreground truncate text-sm font-medium">
								{item.wr_subject}
							</span>
							{#if item.wr_comment > 0 && !isComment(item)}
								<span class="text-primary shrink-0 text-xs font-medium">
									[{item.wr_comment}]
								</span>
							{/if}
						</div>
					</div>

					<!-- 메타 정보 -->
					<div
						class="text-muted-foreground flex shrink-0 items-center gap-2 text-xs"
					>
						<span class="hidden sm:inline">{item.wr_name}</span>
						{#if !isComment(item)}
							<span class="hidden items-center gap-0.5 sm:flex">
								<Eye class="h-3 w-3" />
								{item.wr_hit}
							</span>
						{/if}
						<span class="w-14 text-right">{formatTime(item.bn_datetime)}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}

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

		<p class="text-muted-foreground mt-4 text-center text-sm">
			{data.pagination.page} / {data.pagination.totalPages} 페이지
		</p>
	{/if}
</div>
