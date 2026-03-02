<script lang="ts">
	/**
	 * 이용제한 기록 상세 페이지
	 */
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Calendar from '@lucide/svelte/icons/calendar';
	import User from '@lucide/svelte/icons/user';
	import FileText from '@lucide/svelte/icons/file-text';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import {
		getDisciplineLog,
		getPenaltyDisplay,
		type DisciplineLogDetail
	} from '$lib/api/discipline-log.js';

	let log = $state<DisciplineLogDetail | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const id = $derived(Number(page.params.id));

	async function fetchLog() {
		loading = true;
		error = null;
		try {
			const result = await getDisciplineLog(id);
			log = result.data;
		} catch (e) {
			error = '이용제한 기록을 불러오는데 실패했습니다.';
			log = null;
		} finally {
			loading = false;
		}
	}

	function getPenaltyBadgeClass(period: number): string {
		if (period === -1) return 'bg-fuchsia-600 hover:bg-fuchsia-700';
		if (period === 0) return 'bg-orange-500 hover:bg-orange-600';
		return 'bg-red-600 hover:bg-red-700';
	}

	function formatPeriodRange(log: DisciplineLogDetail): string {
		const penalty = getPenaltyDisplay(log.penalty_period);
		if (log.penalty_period === -1) {
			return `${log.penalty_date_from} ~ 영구`;
		} else if (log.penalty_period === 0) {
			return log.penalty_date_from;
		} else {
			return `${log.penalty_date_from} ~ ${log.penalty_date_to || ''}`;
		}
	}

	function getReportedItemUrl(item: { table: string; id: number; parent?: number }): string {
		if (item.parent && item.parent > 0) {
			return `/${item.table}/${item.id}#comment-${item.parent}`;
		}
		return `/${item.table}/${item.id}`;
	}

	function getReportedItemLabel(item: { table: string; id: number; parent?: number }): string {
		if (item.parent && item.parent > 0) {
			return `/${item.table}/${item.id} (댓글 #${item.parent})`;
		}
		return `/${item.table}/${item.id}`;
	}

	// Check if the user can appeal (within 15 days for penalty >= 1 day)
	function canAppeal(log: DisciplineLogDetail): boolean {
		if (log.penalty_period < 1) return false;

		const penaltyDate = new Date(log.penalty_date_from);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - penaltyDate.getTime()) / (1000 * 60 * 60 * 24));
		return diffDays <= 15;
	}

	onMount(() => {
		fetchLog();
	});
</script>

<svelte:head>
	<title>이용제한 기록 상세</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-6">
	<!-- Back button -->
	<div class="mb-4">
		<Button variant="ghost" href="/disciplinelog" class="gap-2">
			<ArrowLeft class="h-4 w-4" />
			목록으로
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	{:else if error || !log}
		<Card.Root>
			<Card.Content class="flex flex-col items-center justify-center py-12 text-muted-foreground">
				<AlertTriangle class="h-12 w-12 mb-4" />
				<p>{error || '이용제한 기록을 찾을 수 없습니다.'}</p>
				<Button variant="outline" class="mt-4" onclick={() => fetchLog()}>
					다시 시도
				</Button>
			</Card.Content>
		</Card.Root>
	{:else}
		{@const penalty = getPenaltyDisplay(log.penalty_period)}

		<!-- Basic Info -->
		<Card.Root class="mb-4">
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<User class="h-5 w-5" />
					기본 정보
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<div class="text-sm text-muted-foreground mb-1">닉네임</div>
						<div class="font-medium">{log.member_nickname}</div>
					</div>
					<div>
						<div class="text-sm text-muted-foreground mb-1">아이디</div>
						<div class="font-medium">{log.member_id}</div>
					</div>
				</div>
				<div>
					<div class="text-sm text-muted-foreground mb-1">제재 기간</div>
					<div class="flex items-center gap-2">
						<Badge
							variant="destructive"
							class={getPenaltyBadgeClass(log.penalty_period)}
						>
							{penalty.text}
						</Badge>
						<span class="text-sm text-muted-foreground">
							({formatPeriodRange(log)})
						</span>
					</div>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Violation Types -->
		<Card.Root class="mb-4">
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<AlertTriangle class="h-5 w-5 text-destructive" />
					제재 사유
				</Card.Title>
			</Card.Header>
			<Card.Content>
				<div class="space-y-3">
					{#each log.violation_types as vt}
						<div class="rounded-lg bg-muted/50 p-3">
							<div class="font-medium text-sm">{vt.title}</div>
							<div class="text-sm text-muted-foreground mt-1">{vt.description}</div>
						</div>
					{/each}
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Reported Items -->
		{#if log.reported_items && log.reported_items.length > 0}
			<Card.Root class="mb-4">
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<FileText class="h-5 w-5" />
						신고된 글
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-2">
						{#each log.reported_items as item}
							<a
								href={getReportedItemUrl(item)}
								class="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors text-sm"
							>
								<ExternalLink class="h-4 w-4 text-muted-foreground" />
								<span class="text-primary hover:underline">
									{getReportedItemLabel(item)}
								</span>
							</a>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Appeal Info -->
		{#if canAppeal(log)}
			<Card.Root class="border-blue-500/50 bg-blue-500/5">
				<Card.Header>
					<Card.Title class="flex items-center gap-2 text-blue-600 dark:text-blue-400">
						<Calendar class="h-5 w-5" />
						소명 안내
					</Card.Title>
				</Card.Header>
				<Card.Content>
					<p class="text-sm text-muted-foreground mb-4">
						이용제한에 대해 이의가 있으시면 소명 게시판에서 소명하실 수 있습니다.
						소명은 제재 시작일로부터 15일 이내에만 가능합니다.
					</p>
					<Button variant="outline" href="/claim">
						소명하기
					</Button>
				</Card.Content>
			</Card.Root>
		{/if}

		<!-- Meta Info -->
		<div class="text-xs text-muted-foreground mt-4 text-center">
			작성일: {log.created_at} · 작성자: {log.created_by}
		</div>
	{/if}
</div>
