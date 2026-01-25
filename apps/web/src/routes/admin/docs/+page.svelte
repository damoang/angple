<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { ExternalLink, RefreshCw, AlertCircle } from '@lucide/svelte/icons';

	/**
	 * API 문서 페이지 (Swagger UI 임베드)
	 *
	 * Backend 서버의 Swagger UI를 iframe으로 임베드합니다.
	 * WordPress 스타일로 단일 URL에서 API 문서도 제공합니다.
	 */

	const SWAGGER_URL = 'http://localhost:8081/swagger/index.html';

	let isLoading = $state(true);
	let hasError = $state(false);
	let iframeElement: HTMLIFrameElement | null = $state(null);

	function handleIframeLoad() {
		isLoading = false;
		hasError = false;
	}

	function handleIframeError() {
		isLoading = false;
		hasError = true;
	}

	function refreshSwagger() {
		if (iframeElement) {
			isLoading = true;
			hasError = false;
			iframeElement.src = SWAGGER_URL;
		}
	}

	function openInNewTab() {
		if (browser) {
			window.open(SWAGGER_URL, '_blank');
		}
	}

	onMount(() => {
		// iframe 로드 타임아웃 체크
		const timeout = setTimeout(() => {
			if (isLoading) {
				hasError = true;
				isLoading = false;
			}
		}, 10000);

		return () => clearTimeout(timeout);
	});
</script>

<div class="flex h-full flex-col">
	<!-- 헤더 -->
	<div class="border-border flex items-center justify-between border-b bg-white px-6 py-4 dark:bg-gray-900">
		<div>
			<h1 class="text-2xl font-bold">API 문서</h1>
			<p class="text-muted-foreground text-sm">Swagger UI를 통한 API 탐색 및 테스트</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={refreshSwagger}
				class="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
				title="새로고침"
			>
				<RefreshCw class="h-4 w-4" />
				새로고침
			</button>
			<button
				onclick={openInNewTab}
				class="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
				title="새 탭에서 열기"
			>
				<ExternalLink class="h-4 w-4" />
				새 탭에서 열기
			</button>
		</div>
	</div>

	<!-- 콘텐츠 영역 -->
	<div class="relative flex-1">
		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
				<div class="text-center">
					<div
						class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
					></div>
					<p class="text-muted-foreground mt-4">API 문서 로딩 중...</p>
				</div>
			</div>
		{/if}

		{#if hasError}
			<div class="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900">
				<div class="text-center">
					<AlertCircle class="text-destructive mx-auto h-12 w-12" />
					<h2 class="mt-4 text-xl font-semibold">연결 실패</h2>
					<p class="text-muted-foreground mt-2">
						Backend 서버에 연결할 수 없습니다.<br />
						서버가 실행 중인지 확인해주세요.
					</p>
					<div class="mt-4 space-y-2">
						<p class="text-muted-foreground text-sm">
							Swagger URL: <code class="bg-muted rounded px-2 py-1">{SWAGGER_URL}</code>
						</p>
						<button
							onclick={refreshSwagger}
							class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm transition-colors"
						>
							다시 시도
						</button>
					</div>
				</div>
			</div>
		{/if}

		<iframe
			bind:this={iframeElement}
			src={SWAGGER_URL}
			title="Swagger UI"
			class="h-full w-full border-0"
			class:hidden={hasError}
			onload={handleIframeLoad}
			onerror={handleIframeError}
		></iframe>
	</div>
</div>
