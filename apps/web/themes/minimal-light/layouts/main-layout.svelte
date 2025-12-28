<script lang="ts">
	import favicon from '$lib/assets/favicon.png';
	import { onMount } from 'svelte';
	import { authActions } from '$lib/stores/auth.svelte';
	import MinimalHeader from '../components/minimal-header.svelte';
	import MinimalFooter from '../components/minimal-footer.svelte';

	/**
	 * Minimal Light Theme - 미니멀 1단 레이아웃
	 * - 사이드바 없음
	 * - 깔끔한 중앙 정렬
	 * - 그린 + 시안 색상
	 */

	const { children } = $props();

	onMount(() => {
		console.log('🎨 Minimal Light Theme 레이아웃 마운트됨');
		authActions.initAuth();
	});
</script>

<svelte:head>
	<title>Minimal Light - 다모앙</title>
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="icon" href={favicon} />
	<meta name="description" content="미니멀 1단 레이아웃" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-white">
	<!-- Header -->
	<MinimalHeader />

	<!-- Main Content -->
	<div class="flex-1 py-8">
		<main class="container mx-auto max-w-3xl px-4">
			<div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
				{@render children()}
			</div>
		</main>
	</div>

	<!-- Footer -->
	<MinimalFooter />
</div>
