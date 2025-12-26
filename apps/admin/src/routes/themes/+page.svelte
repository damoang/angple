<script lang="ts">
	import { themeStore } from '$lib/stores/theme-store.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Toaster } from '$lib/components/ui/sonner';

	// Store에서 테마 목록 가져오기
	const themes = $derived(themeStore.themes);

	// 상태별 Badge variant 매핑
	function getStatusVariant(status: string) {
		switch (status) {
			case 'active':
				return 'default';
			case 'inactive':
				return 'secondary';
			case 'installing':
				return 'outline';
			case 'error':
				return 'destructive';
			default:
				return 'secondary';
		}
	}

	// 상태 한글 변환
	function getStatusLabel(status: string) {
		switch (status) {
			case 'active':
				return '활성화';
			case 'inactive':
				return '비활성화';
			case 'installing':
				return '설치 중';
			case 'error':
				return '오류';
			default:
				return status;
		}
	}
</script>

<Toaster />

<div class="container mx-auto p-8">
	<div class="mb-8">
		<h1 class="text-4xl font-bold">테마 관리</h1>
		<p class="text-muted-foreground mt-2">설치된 테마를 관리하고 새로운 테마를 추가하세요.</p>
	</div>

	<!-- 상단 액션 바 -->
	<div class="mb-6 flex items-center justify-between">
		<div class="flex gap-2">
			<Button>새 테마 설치</Button>
			<Button variant="outline">마켓플레이스</Button>
		</div>
		<div class="text-muted-foreground text-sm">총 {themes.length}개 테마</div>
	</div>

	<!-- 테마 목록 -->
	<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each themes as theme}
			<Card class="overflow-hidden">
				<!-- 스크린샷 영역 -->
				{#if theme.manifest.screenshot}
					<div class="bg-muted aspect-video">
						<img
							src={theme.manifest.screenshot}
							alt={theme.manifest.name}
							class="h-full w-full object-cover"
						/>
					</div>
				{:else}
					<div class="bg-muted flex aspect-video items-center justify-center">
						<span class="text-muted-foreground text-sm">이미지 없음</span>
					</div>
				{/if}

				<CardHeader>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<CardTitle>{theme.manifest.name}</CardTitle>
							<CardDescription class="mt-1">
								v{theme.manifest.version} · {theme.manifest.author.name}
							</CardDescription>
						</div>
						<Badge variant={getStatusVariant(theme.status)}>
							{getStatusLabel(theme.status)}
						</Badge>
					</div>
				</CardHeader>

				<CardContent>
					<p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
						{theme.manifest.description}
					</p>

					<!-- 태그 -->
					{#if theme.manifest.tags && theme.manifest.tags.length > 0}
						<div class="mb-4 flex flex-wrap gap-1">
							{#each theme.manifest.tags.slice(0, 3) as tag}
								<Badge variant="outline" class="text-xs">{tag}</Badge>
							{/each}
						</div>
					{/if}

					<!-- 통계 -->
					<div class="text-muted-foreground mb-4 flex gap-4 text-xs">
						{#if theme.downloadCount}
							<span>다운로드 {theme.downloadCount.toLocaleString()}</span>
						{/if}
						{#if theme.manifest.components}
							<span>컴포넌트 {theme.manifest.components.length}개</span>
						{/if}
						{#if theme.manifest.hooks}
							<span>훅 {theme.manifest.hooks.length}개</span>
						{/if}
					</div>

					<!-- 액션 버튼 -->
					<div class="flex gap-2">
						{#if theme.status === 'active'}
							<Button
								variant="outline"
								size="sm"
								class="flex-1"
								href={`/themes/${theme.manifest.id}/settings`}
							>
								설정
							</Button>
							<Button
								variant="outline"
								size="sm"
								class="flex-1"
								disabled={themeStore.isThemeLoading(theme.manifest.id)}
								onclick={() => themeStore.deactivateTheme(theme.manifest.id)}
							>
								{themeStore.isActionInProgress(theme.manifest.id, 'deactivate')
									? '처리 중...'
									: '비활성화'}
			</Button>
						{:else if theme.status === 'inactive'}
							<Button
								size="sm"
								class="flex-1"
								disabled={themeStore.isThemeLoading(theme.manifest.id)}
								onclick={() => themeStore.activateTheme(theme.manifest.id)}
							>
								{themeStore.isActionInProgress(theme.manifest.id, 'activate')
									? '처리 중...'
									: '활성화'}
							</Button>
							<Button
								variant="outline"
								size="sm"
								class="flex-1"
								href={`/themes/${theme.manifest.id}/settings`}
							>
								설정
							</Button>
						{:else if theme.status === 'installing'}
							<Button disabled size="sm" class="flex-1">설치 중...</Button>
						{:else if theme.status === 'error'}
							<Button
								variant="destructive"
								size="sm"
								class="flex-1"
								disabled={themeStore.isThemeLoading(theme.manifest.id)}
								onclick={() => themeStore.retryInstall(theme.manifest.id)}
							>
								{themeStore.isActionInProgress(theme.manifest.id, 'install')
									? '처리 중...'
									: '재시도'}
							</Button>
							<Button
								variant="outline"
								size="sm"
								class="flex-1"
								disabled={themeStore.isThemeLoading(theme.manifest.id)}
								onclick={() => themeStore.deleteTheme(theme.manifest.id)}
							>
								{themeStore.isActionInProgress(theme.manifest.id, 'delete') ? '삭제 중...' : '삭제'}
							</Button>
						{/if}
					</div>

					<!-- 에러 메시지 -->
					{#if theme.status === 'error' && theme.errorMessage}
						<div class="bg-destructive/10 text-destructive mt-3 rounded-md p-2 text-xs">
							{theme.errorMessage}
						</div>
					{/if}
				</CardContent>
			</Card>
		{/each}
	</div>
</div>
