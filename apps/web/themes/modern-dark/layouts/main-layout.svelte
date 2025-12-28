<script lang="ts">
	import favicon from '$lib/assets/favicon.png';
	import { onMount } from 'svelte';
	import { authActions } from '$lib/stores/auth.svelte';
	import DarkHeader from '../components/dark-header.svelte';
	import DarkFooter from '../components/dark-footer.svelte';
	import DarkSidebar from '../components/dark-sidebar.svelte';

	/**
	 * Modern Dark Theme - 다크모드 최적화 레이아웃
	 * - 어두운 배경
	 * - 눈의 피로 감소
	 * - 슬레이트 그레이 계열
	 */

	const { children } = $props();

	onMount(() => {
		console.log('🎨 Modern Dark Theme 레이아웃 마운트됨');
		authActions.initAuth();
	});
</script>

<svelte:head>
	<title>Modern Dark - 다모앙</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="icon" href={favicon} />
	<meta name="description" content="다크모드 최적화 레이아웃" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-slate-900 text-slate-100">
	<!-- Header -->
	<DarkHeader />

	<!-- Main Content Area -->
	<div class="container mx-auto flex flex-1 gap-6 px-4 py-6">
		<!-- Sidebar -->
		<aside class="hidden w-64 flex-shrink-0 lg:block">
			<DarkSidebar />
		</aside>

		<!-- Page Content -->
		<main class="min-w-0 flex-1 rounded-lg bg-slate-800 p-6 shadow-xl">
			{@render children()}
		</main>
	</div>

	<!-- Footer -->
	<DarkFooter />
</div>
