<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { themeStore } from '$lib/stores/theme-store.svelte';

	/**
	 * WordPress 스타일 동적 레이아웃 시스템
	 *
	 * - 활성화된 테마의 레이아웃 컴포넌트 로드
	 * - 테마 없으면 기본 레이아웃 사용
	 * - Hook 시스템 자동 초기화
	 * - 테마 변경 감지 (5초 주기 폴링)
	 */

	const { children } = $props(); // Svelte 5

	// 동적 레이아웃 컴포넌트
	const Layout = $derived(themeStore.layoutComponent);

	onMount(async () => {
		// 테마 시스템 초기화
		await themeStore.loadActiveTheme();

		// 테마 변경 감지 폴링 시작
		themeStore.startPolling();
	});

	onDestroy(() => {
		// 폴링 정리
		themeStore.stopPolling();
	});
</script>

{#if themeStore.isInitialized}
	<Layout {children} />
{:else}
	<!-- 테마 로딩 중 -->
	<div class="flex h-screen items-center justify-center">
		<div class="text-center">
			<div class="mb-4 text-2xl">🎨</div>
			<p class="text-muted-foreground">테마 로딩 중...</p>
		</div>
	</div>
{/if}
