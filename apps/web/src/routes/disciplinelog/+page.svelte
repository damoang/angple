<script lang="ts">
	/**
	 * 이용제한 기록 목록 페이지
	 */
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import {
		getDisciplineLogs,
		getPenaltyDisplay,
		type DisciplineLogListItem
	} from '$lib/api/discipline-log.js';

	let logs = $state<DisciplineLogListItem[]>([]);
	let total = $state(0);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let currentPage = $state(1);
	const pageSize = 20;

	const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

	async function fetchLogs() {
		loading = true;
		error = null;
		try {
			const result = await getDisciplineLogs(currentPage, pageSize);
			logs = result.data || [];
			total = result.meta?.total || 0;
		} catch (e) {
			error = '이용제한 기록을 불러오는데 실패했습니다.';
			logs = [];
			total = 0;
		} finally {
			loading = false;
		}
	}

	function goToPage(page: number) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
		fetchLogs();
	}

	function getPenaltyBadgeVariant(period: number): 'default' | 'secondary' | 'destructive' | 'outline' {
		if (period === -1) return 'destructive';
		if (period === 0) return 'secondary';
		return 'destructive';
	}

	function getPenaltyBadgeClass(period: number): string {
		if (period === -1) return 'bg-fuchsia-600 hover:bg-fuchsia-700';
		if (period === 0) return 'bg-orange-500 hover:bg-orange-600';
		return 'bg-red-600 hover:bg-red-700';
	}

	onMount(() => {
		fetchLogs();
	});
</script>

<svelte:head>
	<title>이용제한 기록</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-6">
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<AlertTriangle class="h-5 w-5 text-destructive" />
				이용제한 기록
			</Card.Title>
			<Card.Description>
				규정을 위반한 회원에 대한 제재 기록입니다.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			{:else if error}
				<div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<AlertTriangle class="h-12 w-12 mb-4" />
					<p>{error}</p>
					<Button variant="outline" class="mt-4" onclick={() => fetchLogs()}>
						다시 시도
					</Button>
				</div>
			{:else if logs.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-muted-foreground">
					<p>이용제한 기록이 없습니다.</p>
				</div>
			{:else}
				<!-- Desktop table -->
				<div class="hidden md:block overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b bg-muted/50">
								<th class="p-3 text-left font-medium">닉네임</th>
								<th class="p-3 text-left font-medium">아이디</th>
								<th class="p-3 text-left font-medium">시작일</th>
								<th class="p-3 text-center font-medium">기간</th>
								<th class="p-3 text-left font-medium">사유</th>
							</tr>
						</thead>
						<tbody>
							{#each logs as log (log.id)}
								{@const penalty = getPenaltyDisplay(log.penalty_period)}
								<tr class="border-b hover:bg-muted/50 transition-colors">
									<td class="p-3">
										<a
											href="/disciplinelog/{log.id}"
											class="font-medium text-foreground hover:text-primary hover:underline"
										>
											{log.member_nickname}
										</a>
									</td>
									<td class="p-3 text-muted-foreground">{log.member_id}</td>
									<td class="p-3 text-muted-foreground">{log.penalty_date_from}</td>
									<td class="p-3 text-center">
										<Badge
											variant={getPenaltyBadgeVariant(log.penalty_period)}
											class={getPenaltyBadgeClass(log.penalty_period)}
										>
											{penalty.text}
										</Badge>
									</td>
									<td class="p-3">
										<div class="flex flex-wrap gap-1">
											{#each log.violation_titles.slice(0, 3) as title}
												<Badge variant="outline" class="text-xs">{title}</Badge>
											{/each}
											{#if log.violation_titles.length > 3}
												<Badge variant="outline" class="text-xs">+{log.violation_titles.length - 3}</Badge>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Mobile cards -->
				<div class="md:hidden space-y-3">
					{#each logs as log (log.id)}
						{@const penalty = getPenaltyDisplay(log.penalty_period)}
						<a href="/disciplinelog/{log.id}" class="block">
							<div class="rounded-lg border p-4 hover:bg-muted/50 transition-colors">
								<div class="flex items-center justify-between mb-2">
									<span class="font-medium">{log.member_nickname}</span>
									<Badge
										variant={getPenaltyBadgeVariant(log.penalty_period)}
										class={getPenaltyBadgeClass(log.penalty_period)}
									>
										{penalty.text}
									</Badge>
								</div>
								<div class="text-sm text-muted-foreground mb-2">
									{log.member_id} · {log.penalty_date_from}
								</div>
								<div class="flex flex-wrap gap-1">
									{#each log.violation_titles.slice(0, 2) as title}
										<Badge variant="outline" class="text-xs">{title}</Badge>
									{/each}
									{#if log.violation_titles.length > 2}
										<Badge variant="outline" class="text-xs">+{log.violation_titles.length - 2}</Badge>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="flex items-center justify-center gap-1 mt-6">
						<Button
							variant="outline"
							size="icon"
							onclick={() => goToPage(currentPage - 1)}
							disabled={currentPage <= 1}
						>
							<ChevronLeft class="h-4 w-4" />
						</Button>
						{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
							const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
							return start + i;
						}).filter(p => p <= totalPages) as page}
							<Button
								variant={page === currentPage ? 'default' : 'outline'}
								size="icon"
								onclick={() => goToPage(page)}
							>
								{page}
							</Button>
						{/each}
						<Button
							variant="outline"
							size="icon"
							onclick={() => goToPage(currentPage + 1)}
							disabled={currentPage >= totalPages}
						>
							<ChevronRight class="h-4 w-4" />
						</Button>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
