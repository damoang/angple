<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { onMount } from 'svelte';
	import Users from '@lucide/svelte/icons/users';
	import Heart from '@lucide/svelte/icons/heart';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
	import type {
		AnalysisPeriod,
		InteractionType,
		InteractionDirection,
		InteractionEntry
	} from '../lib/types.js';

	let { memberId }: { memberId: string } = $props();

	// 필터 상태
	let period = $state<AnalysisPeriod>('month');
	let type = $state<InteractionType>('all');
	let direction = $state<InteractionDirection>('received');

	// 데이터 상태
	let entries = $state<InteractionEntry[]>([]);
	let totalInteractions = $state(0);
	let isLoading = $state(false);
	let error = $state('');
	let periodLabel = $state('');

	// 권한 확인 (관리자 또는 본인)
	const canView = $derived(
		authStore.isAuthenticated &&
			((authStore.user?.mb_level ?? 0) >= 10 || authStore.user?.mb_id === memberId)
	);

	const periods: { value: AnalysisPeriod; label: string }[] = [
		{ value: 'day', label: '오늘' },
		{ value: 'week', label: '1주' },
		{ value: 'month', label: '1달' },
		{ value: 'year', label: '1년' },
		{ value: 'all', label: '전체' }
	];

	const types: { value: InteractionType; label: string; icon: string }[] = [
		{ value: 'all', label: '전체', icon: '' },
		{ value: 'like', label: '공감', icon: '' },
		{ value: 'comment', label: '댓글', icon: '' }
	];

	const directions: { value: InteractionDirection; label: string }[] = [
		{ value: 'received', label: '받은 상호작용' },
		{ value: 'given', label: '보낸 상호작용' }
	];

	async function loadData() {
		if (!canView) return;

		isLoading = true;
		error = '';
		try {
			const params = new URLSearchParams({
				period,
				type,
				direction,
				limit: '10'
			});
			const res = await fetch(`/api/members/${memberId}/interactions?${params}`);
			const data = await res.json();

			if (data.success) {
				entries = data.data.entries;
				totalInteractions = data.data.total_interactions;
				periodLabel = data.data.period_label;
			} else {
				error = data.error || '데이터를 가져올 수 없습니다.';
				entries = [];
			}
		} catch (err) {
			error = '분석 데이터를 가져오는데 실패했습니다.';
			entries = [];
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		if (canView) loadData();
	});

	// 필터 변경 시 자동 새로고침
	$effect(() => {
		// 의존성 참조
		period;
		type;
		direction;
		if (canView) loadData();
	});

	// 바 차트 최대값
	const maxCount = $derived(entries.length > 0 ? entries[0].total_count : 1);

	// 상호작용 강도 색상
	function getBarColor(count: number, max: number): string {
		const ratio = count / max;
		if (ratio > 0.7) return 'bg-red-500 dark:bg-red-600';
		if (ratio > 0.4) return 'bg-orange-400 dark:bg-orange-500';
		if (ratio > 0.2) return 'bg-yellow-400 dark:bg-yellow-500';
		return 'bg-blue-400 dark:bg-blue-500';
	}
</script>

{#if canView}
	<Card class="bg-background">
		<CardHeader>
			<div class="flex items-center gap-2">
				<BarChart3 class="text-primary h-5 w-5" />
				<CardTitle class="text-lg">상호작용 분석</CardTitle>
				{#if (authStore.user?.mb_level ?? 0) >= 10}
					<Badge variant="outline" class="ml-auto text-xs">관리자</Badge>
				{/if}
			</div>
		</CardHeader>

		<CardContent class="space-y-4">
			<!-- 필터 컨트롤 -->
			<div class="space-y-3">
				<!-- 방향 선택 -->
				<div class="flex gap-2">
					{#each directions as dir (dir.value)}
						<Button
							variant={direction === dir.value ? 'default' : 'outline'}
							size="sm"
							onclick={() => (direction = dir.value)}
						>
							<ArrowUpDown class="mr-1 h-3 w-3" />
							{dir.label}
						</Button>
					{/each}
				</div>

				<!-- 기간 + 타입 선택 -->
				<div class="flex flex-wrap gap-1.5">
					{#each periods as p (p.value)}
						<Badge
							variant={period === p.value ? 'default' : 'outline'}
							class="cursor-pointer px-3 py-1"
							onclick={() => (period = p.value)}
						>
							{p.label}
						</Badge>
					{/each}

					<span class="border-border mx-1 border-l"></span>

					{#each types as t (t.value)}
						<Badge
							variant={type === t.value ? 'default' : 'outline'}
							class="cursor-pointer px-3 py-1"
							onclick={() => (type = t.value)}
						>
							{#if t.value === 'like'}
								<Heart class="mr-1 h-3 w-3" />
							{:else if t.value === 'comment'}
								<MessageSquare class="mr-1 h-3 w-3" />
							{:else}
								<Users class="mr-1 h-3 w-3" />
							{/if}
							{t.label}
						</Badge>
					{/each}
				</div>
			</div>

			<!-- 결과 -->
			{#if isLoading}
				<div class="text-muted-foreground py-8 text-center text-sm">분석 중...</div>
			{:else if error}
				<div class="text-destructive py-4 text-center text-sm">{error}</div>
			{:else if entries.length === 0}
				<div class="text-muted-foreground py-8 text-center text-sm">
					{periodLabel} 기간의 상호작용 데이터가 없습니다.
				</div>
			{:else}
				<!-- 요약 -->
				<div class="text-muted-foreground text-xs">
					{periodLabel} · {direction === 'received' ? '이 회원의 글에 반응한' : '이 회원이 반응한'}
					상위 {entries.length}명 · 총 {totalInteractions.toLocaleString()}건
				</div>

				<!-- 순위 리스트 -->
				<div class="space-y-2">
					{#each entries as entry, i (entry.mb_id)}
						<div class="flex items-center gap-3">
							<!-- 순위 -->
							<span class="text-muted-foreground w-5 text-right text-sm font-medium">
								{i + 1}
							</span>

							<!-- 닉네임 -->
							<a
								href="/member/{entry.mb_id}"
								class="text-foreground hover:text-primary w-24 truncate text-sm font-medium sm:w-32"
								title={entry.mb_name}
							>
								{entry.mb_name}
							</a>

							<!-- 바 차트 -->
							<div class="flex flex-1 items-center gap-2">
								<div class="bg-muted h-5 flex-1 overflow-hidden rounded-full">
									<div
										class="h-full rounded-full transition-all duration-300 {getBarColor(entry.total_count, maxCount)}"
										style="width: {Math.max((entry.total_count / maxCount) * 100, 3)}%"
									></div>
								</div>
							</div>

							<!-- 카운트 상세 -->
							<div class="flex items-center gap-2 text-xs">
								{#if type === 'all' || type === 'like'}
									<span class="text-red-500" title="공감">
										<Heart class="mr-0.5 inline h-3 w-3" />{entry.like_count}
									</span>
								{/if}
								{#if type === 'all' || type === 'comment'}
									<span class="text-blue-500" title="댓글">
										<MessageSquare class="mr-0.5 inline h-3 w-3" />{entry.comment_count}
									</span>
								{/if}
								<span class="text-foreground min-w-[2rem] text-right font-semibold">
									{entry.total_count}
								</span>
							</div>
						</div>
					{/each}
				</div>

				<!-- 패턴 경고 (관리자용) -->
				{#if (authStore.user?.mb_level ?? 0) >= 10 && entries.length >= 2}
					{@const topRatio = entries[0].total_count / Math.max(totalInteractions, 1)}
					{#if topRatio > 0.3}
						<div class="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm dark:border-yellow-700 dark:bg-yellow-900/20">
							<span class="font-medium text-yellow-800 dark:text-yellow-200">
								집중도 주의:
							</span>
							<span class="text-yellow-700 dark:text-yellow-300">
								1위 {entries[0].mb_name}의 비중이 {(topRatio * 100).toFixed(0)}%로 높습니다.
								상호 관계를 확인해보세요.
							</span>
						</div>
					{/if}
				{/if}
			{/if}
		</CardContent>
	</Card>
{/if}
