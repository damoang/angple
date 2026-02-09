<script lang="ts">
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription
	} from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import Unlink from '@lucide/svelte/icons/unlink';
	import Link from '@lucide/svelte/icons/link';
	import Settings from '@lucide/svelte/icons/settings';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	let profiles = $state(data.socialProfiles);
	let disconnecting = $state<number | null>(null);
	let error = $state<string | null>(null);

	const providerNames: Record<string, string> = {
		google: 'Google',
		kakao: '카카오',
		naver: '네이버',
		apple: 'Apple',
		facebook: 'Facebook',
		twitter: 'X (Twitter)',
		payco: 'PAYCO'
	};

	const providerColors: Record<string, string> = {
		google: 'bg-white text-gray-700 border',
		kakao: 'bg-[#FEE500] text-[#191919]',
		naver: 'bg-[#03C75A] text-white',
		apple: 'bg-black text-white',
		facebook: 'bg-[#1877F2] text-white',
		twitter: 'bg-black text-white',
		payco: 'bg-[#E42529] text-white'
	};

	async function disconnectSocial(mpNo: number): Promise<void> {
		if (disconnecting) return;

		if (!confirm('이 소셜 계정 연결을 해제하시겠습니까?')) return;

		disconnecting = mpNo;
		error = null;

		try {
			const response = await fetch('/member/settings/social', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mp_no: mpNo })
			});

			const result = await response.json();

			if (result.success) {
				profiles = profiles.filter((p) => p.mpNo !== mpNo);
			} else {
				error = result.error || '해제에 실패했습니다.';
			}
		} catch {
			error = '요청 중 오류가 발생했습니다.';
		} finally {
			disconnecting = null;
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>회원 설정 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
	<div class="mb-6 flex items-center gap-3">
		<Settings class="h-6 w-6" />
		<h1 class="text-foreground text-2xl font-bold">회원 설정</h1>
	</div>

	<!-- 소셜 계정 관리 -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<Link class="h-5 w-5" />
				연결된 소셜 계정
			</CardTitle>
			<CardDescription>소셜 로그인에 사용되는 계정을 관리합니다.</CardDescription>
		</CardHeader>
		<CardContent>
			{#if error}
				<div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
					{error}
				</div>
			{/if}

			{#if profiles.length === 0}
				<p class="text-muted-foreground py-4 text-center text-sm">
					연결된 소셜 계정이 없습니다.
				</p>
			{:else}
				<div class="space-y-3">
					{#each profiles as profile (profile.mpNo)}
						<div
							class="border-border flex items-center justify-between rounded-lg border p-4"
						>
							<div class="flex items-center gap-3">
								<Badge
									class="px-3 py-1 {providerColors[profile.provider] || 'bg-gray-100'}"
								>
									{providerNames[profile.provider] || profile.provider}
								</Badge>
								<div>
									{#if profile.displayname}
										<p class="text-foreground text-sm font-medium">
											{profile.displayname}
										</p>
									{/if}
									<p class="text-muted-foreground text-xs">
										연결일: {formatDate(profile.registeredAt)}
									</p>
								</div>
							</div>
							<Button
								variant="outline"
								size="sm"
								onclick={() => disconnectSocial(profile.mpNo)}
								disabled={disconnecting !== null}
							>
								{#if disconnecting === profile.mpNo}
									<Loader2 class="mr-1 h-4 w-4 animate-spin" />
								{:else}
									<Unlink class="mr-1 h-4 w-4" />
								{/if}
								해제
							</Button>
						</div>
					{/each}
				</div>
			{/if}

			<Separator class="my-4" />

			<div>
				<p class="text-muted-foreground mb-3 text-sm">
					새 소셜 계정을 연결하려면 해당 서비스로 로그인하세요.
				</p>
				<Button variant="outline" href="/login?redirect=/member/settings">
					<Link class="mr-2 h-4 w-4" />
					소셜 계정 추가 연결
				</Button>
			</div>
		</CardContent>
	</Card>
</div>
