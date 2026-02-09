<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { enhance } from '$app/forms';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	let confirmText = $state('');
	let errorMsg = $state<string | null>(null);
	let submitting = $state(false);

	const isValid = $derived(confirmText.trim() === '탈퇴합니다');
</script>

<svelte:head>
	<title>회원 탈퇴 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-8">
	<Card class="border-destructive/30">
		<CardHeader>
			<CardTitle class="flex items-center gap-2 text-red-600">
				<TriangleAlert class="h-5 w-5" />
				회원 탈퇴
			</CardTitle>
			<CardDescription>
				탈퇴 시 아래 사항을 확인해주세요.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<!-- 경고 사항 -->
			<div class="bg-destructive/5 mb-6 rounded-lg p-4 text-sm">
				<ul class="space-y-2 text-red-700">
					<li>- 탈퇴 후 동일 아이디로 재가입이 불가합니다.</li>
					<li>- 작성한 게시글과 댓글은 삭제되지 않습니다.</li>
					<li>- 연결된 소셜 계정이 모두 해제됩니다.</li>
					<li>- 보유 포인트가 소멸됩니다.</li>
				</ul>
			</div>

			<form
				method="POST"
				use:enhance={() => {
					submitting = true;
					errorMsg = null;
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'failure') {
							errorMsg = (result.data?.error as string) || '탈퇴 처리에 실패했습니다.';
						}
					};
				}}
				class="space-y-4"
			>
				<div class="space-y-2">
					<Label for="confirmText">
						탈퇴를 원하시면 <strong class="text-red-600">"탈퇴합니다"</strong>를 입력하세요
					</Label>
					<Input
						id="confirmText"
						name="confirmText"
						bind:value={confirmText}
						placeholder="탈퇴합니다"
						autocomplete="off"
					/>
				</div>

				{#if errorMsg}
					<p class="flex items-center gap-1 text-sm text-red-600">
						<CircleAlert class="h-4 w-4" />{errorMsg}
					</p>
				{/if}

				<div class="flex gap-3">
					<Button variant="outline" href="/member/settings" class="flex-1">
						취소
					</Button>
					<Button
						type="submit"
						variant="destructive"
						class="flex-1"
						disabled={!isValid || submitting}
					>
						{submitting ? '처리 중...' : '회원 탈퇴'}
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>
</div>
