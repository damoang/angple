<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { authStore } from '$lib/stores/auth.svelte.js';
	import { parseBidNumbers, type GivingBid, type GivingStatus } from '$lib/types/giving.js';
	import CountdownTimer from './countdown-timer.svelte';
	import Trophy from '@lucide/svelte/icons/trophy';
	import Users from '@lucide/svelte/icons/users';
	import Clock from '@lucide/svelte/icons/clock';
	import Ticket from '@lucide/svelte/icons/ticket';
	import { onMount } from 'svelte';

	let {
		postId,
		boardId,
		endTime = '',
		startTime = '',
		pointsPerNumber = 0,
		status = 'active' as GivingStatus,
		itemName = ''
	}: {
		postId: number;
		boardId: string;
		endTime?: string;
		startTime?: string;
		pointsPerNumber?: number;
		status?: GivingStatus;
		itemName?: string;
	} = $props();

	let bidInput = $state('');
	let isSubmitting = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');
	let myBids = $state<GivingBid[]>([]);
	let totalParticipants = $state(0);
	let totalBidCount = $state(0);
	let winner = $state<{ mb_nick: string; winning_number: number } | null>(null);
	let isLoading = $state(true);

	// 파싱된 번호 + 필요 포인트 실시간 계산
	const parsedNumbers = $derived(bidInput ? parseBidNumbers(bidInput) : []);
	const requiredPoints = $derived(parsedNumbers.length * pointsPerNumber);

	// 보유 포인트
	const userPoints = $derived(authStore.user?.mb_point ?? 0);
	const hasEnoughPoints = $derived(userPoints >= requiredPoints);

	onMount(async () => {
		await loadBidInfo();
	});

	async function loadBidInfo() {
		isLoading = true;
		try {
			const res = await fetch(`/api/giving/${postId}`);
			if (res.ok) {
				const data = await res.json();
				if (data.success) {
					totalParticipants = data.data.totalParticipants || 0;
					totalBidCount = data.data.totalBidCount || 0;
					myBids = data.data.myBids || [];
					winner = data.data.winner || null;
				}
			}
		} catch (err) {
			console.error('나눔 정보 로드 실패:', err);
		} finally {
			isLoading = false;
		}
	}

	async function handleBid() {
		if (!authStore.isAuthenticated) {
			authStore.redirectToLogin();
			return;
		}

		if (parsedNumbers.length === 0) {
			errorMsg = '번호를 입력해주세요.';
			return;
		}

		if (!hasEnoughPoints) {
			errorMsg = `포인트가 부족합니다. (필요: ${requiredPoints.toLocaleString()}, 보유: ${userPoints.toLocaleString()})`;
			return;
		}

		isSubmitting = true;
		errorMsg = '';
		successMsg = '';

		try {
			const res = await fetch(`/api/giving/${postId}/bid`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ numbers: bidInput })
			});

			const data = await res.json();
			if (data.success) {
				successMsg = `${parsedNumbers.length}개 번호로 응모했습니다!`;
				bidInput = '';
				await loadBidInfo();
			} else {
				errorMsg = data.error || '응모에 실패했습니다.';
			}
		} catch (err) {
			errorMsg = '응모 중 오류가 발생했습니다.';
		} finally {
			isSubmitting = false;
		}
	}

	// 상태별 카드 배경색
	const statusCardClass = $derived(() => {
		switch (status) {
			case 'active':
				return 'border-green-200 dark:border-green-800';
			case 'paused':
				return 'border-yellow-200 dark:border-yellow-800';
			case 'ended':
				return 'border-gray-200 dark:border-gray-700';
			default:
				return 'border-blue-200 dark:border-blue-800';
		}
	});
</script>

<Card class="bg-background {statusCardClass()}">
	<CardHeader>
		<CardTitle class="flex items-center gap-2 text-lg">
			<Ticket class="h-5 w-5" />
			나눔 응모
			{#if itemName}
				<span class="text-muted-foreground text-sm font-normal">- {itemName}</span>
			{/if}
		</CardTitle>
	</CardHeader>

	<CardContent class="space-y-4">
		{#if isLoading}
			<div class="text-muted-foreground py-4 text-center">불러오는 중...</div>
		{:else}
			<!-- 나눔 정보 요약 -->
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<!-- 상태 -->
				<div class="bg-muted/50 rounded-lg p-3 text-center">
					<div class="text-muted-foreground mb-1 text-xs">상태</div>
					{#if status === 'active'}
						<Badge variant="default" class="bg-green-600">진행중</Badge>
					{:else if status === 'paused'}
						<Badge variant="default" class="bg-yellow-600">일시정지</Badge>
					{:else if status === 'ended'}
						<Badge variant="secondary">종료</Badge>
					{:else}
						<Badge variant="default" class="bg-blue-600">대기중</Badge>
					{/if}
				</div>

				<!-- 남은 시간 -->
				<div class="bg-muted/50 rounded-lg p-3 text-center">
					<div class="text-muted-foreground mb-1 text-xs">
						<Clock class="mr-1 inline h-3 w-3" />
						남은 시간
					</div>
					{#if endTime && status !== 'ended'}
						<CountdownTimer {endTime} class="text-sm font-bold" />
					{:else}
						<span class="text-muted-foreground text-sm">-</span>
					{/if}
				</div>

				<!-- 참여자 수 -->
				<div class="bg-muted/50 rounded-lg p-3 text-center">
					<div class="text-muted-foreground mb-1 text-xs">
						<Users class="mr-1 inline h-3 w-3" />
						참여자
					</div>
					<span class="text-foreground text-sm font-bold">{totalParticipants}명</span>
				</div>

				<!-- 번호당 포인트 -->
				<div class="bg-muted/50 rounded-lg p-3 text-center">
					<div class="text-muted-foreground mb-1 text-xs">번호당 포인트</div>
					<span class="text-foreground text-sm font-bold">{pointsPerNumber.toLocaleString()}</span>
				</div>
			</div>

			<!-- 당첨자 (종료 후) -->
			{#if winner && status === 'ended'}
				<div class="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-700 dark:bg-yellow-900/20">
					<div class="flex items-center gap-2">
						<Trophy class="h-5 w-5 text-yellow-500" />
						<span class="font-semibold">당첨자</span>
					</div>
					<p class="mt-2 text-sm">
						<span class="font-medium">{winner.mb_nick}</span>님 -
						당첨번호 <span class="font-bold text-yellow-600 dark:text-yellow-400">{winner.winning_number}</span>
						(최저고유번호)
					</p>
				</div>
			{/if}

			<!-- 내 응모 현황 -->
			{#if myBids.length > 0}
				<div class="rounded-lg border p-3">
					<h4 class="mb-2 text-sm font-semibold">내 응모 현황</h4>
					<div class="space-y-1">
						{#each myBids as bid (bid.bid_id)}
							<div class="text-muted-foreground flex items-center justify-between text-xs">
								<span>번호: {bid.bid_numbers}</span>
								<span>{bid.bid_count}개 · {bid.bid_points.toLocaleString()}P</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- 응모 폼 (진행중일 때만) -->
			{#if status === 'active'}
				<div class="space-y-3">
					<div>
						<label for="bid-input" class="mb-1 block text-sm font-medium">
							응모 번호 입력
						</label>
						<input
							id="bid-input"
							type="text"
							bind:value={bidInput}
							placeholder="예: 1,3,5-10,15~20"
							class="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm"
						/>
						<p class="text-muted-foreground mt-1 text-xs">
							콤마(,)로 구분, 범위는 하이픈(-) 또는 물결(~) 사용
						</p>
					</div>

					{#if parsedNumbers.length > 0}
						<div class="bg-muted/50 flex items-center justify-between rounded-md px-3 py-2 text-sm">
							<span>
								선택 번호: <span class="font-medium">{parsedNumbers.length}개</span>
							</span>
							<span class={!hasEnoughPoints ? 'text-red-500 font-semibold' : 'font-semibold'}>
								필요 포인트: {requiredPoints.toLocaleString()}P
							</span>
						</div>
					{/if}

					{#if errorMsg}
						<p class="text-destructive text-sm">{errorMsg}</p>
					{/if}
					{#if successMsg}
						<p class="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
					{/if}

					<Button
						onclick={handleBid}
						disabled={isSubmitting || parsedNumbers.length === 0 || !hasEnoughPoints}
						class="w-full"
					>
						{#if isSubmitting}
							응모 중...
						{:else if !authStore.isAuthenticated}
							로그인 후 응모
						{:else}
							응모하기 ({parsedNumbers.length}개 번호)
						{/if}
					</Button>
				</div>
			{/if}
		{/if}
	</CardContent>
</Card>
