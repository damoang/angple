<script lang="ts">
	import favicon from '$lib/assets/favicon.png';
	import { onMount } from 'svelte';
	import { authActions } from '$lib/stores/auth.svelte';
	import SampleHeader from '../components/sample-header.svelte';
	import SampleFooter from '../components/sample-footer.svelte';
	import SampleSidebar from '../components/sample-sidebar.svelte';

	/**
	 * Sample Theme - Main Layout
	 *
	 * WordPress 스타일: 테마가 전체 레이아웃을 완전히 제어
	 * - 기본 레이아웃과 완전히 다른 구조
	 * - 파란색 테마
	 * - 간소화된 레이아웃
	 */

	const { children } = $props(); // Svelte 5

	onMount(() => {
		console.log('🎨 Sample Theme 레이아웃 마운트됨');

		// 인증 상태 초기화
		authActions.initAuth();
	});
</script>

<svelte:head>
	<title>Sample Theme - 다모앙</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="icon" href={favicon} />
	<meta name="description" content="Sample Theme - WordPress 스타일 테마 시스템 데모" />
</svelte:head>

<!-- Sample Theme 레이아웃: 완전히 다른 구조 -->
<div class="flex min-h-screen flex-col bg-white">
	<!-- Header -->
	<SampleHeader />

	<!-- Main Content Area -->
	<div class="container mx-auto flex flex-1 gap-6 px-4 py-6">
		<!-- Sidebar -->
		<aside class="hidden w-64 flex-shrink-0 lg:block">
			<SampleSidebar />
		</aside>

		<!-- Page Content -->
		<main class="min-w-0 flex-1">
			<!-- 실제 페이지 콘텐츠 -->
			{@render children()}
		</main>
	</div>

	<!-- Footer -->
	<SampleFooter />
</div>
