<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import Header from '$lib/components/layout/header.svelte';
	import Sidebar from '$lib/components/layout/sidebar.svelte';
	import Panel from '$lib/components/layout/panel.svelte';
	import Footer from '$lib/components/layout/footer.svelte';
	import LeftBanner from '$lib/components/layout/left-banner.svelte';
	import RightBanner from '$lib/components/layout/right-banner.svelte';
	import PodcastPlayer from '$lib/components/ui/podcast-player/podcast-player.svelte';
	import { getComponentsForSlot } from '$lib/components/slot-manager';

	interface Props {
		children: Snippet;
	}

	const { children }: Props = $props();

	// 테마 설정
	let snbPosition = $state<'left' | 'right'>('left');
	let showWingBanners = $state(true);
	let showPodcastPlayer = $state(true);

	let isBannerUp = $state(false);
	let lastScrollY = $state(0);

	function handleScroll() {
		const currentScrollY = window.scrollY;

		if (currentScrollY > lastScrollY && currentScrollY > 80) {
			isBannerUp = true;
		} else if (currentScrollY < lastScrollY) {
			isBannerUp = false;
		}

		lastScrollY = currentScrollY;
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
	});
</script>

<div class="damoang-default-theme relative flex min-h-screen flex-col items-center">
	<!-- 배경 박스 -->
	{#if snbPosition === 'left'}
		<div class="snb-backdrop-left"></div>
	{:else if snbPosition === 'right'}
		<div class="snb-backdrop-right"></div>
	{/if}

	<div class="container relative z-10 flex w-full flex-1 flex-col">
		<!-- Slot: header-before -->
		{#each getComponentsForSlot('header-before') as slotComp (slotComp.id)}
			{@const Component = slotComp.component}
			<Component {...slotComp.props || {}} />
		{/each}

		<Header />

		<!-- Slot: header-after -->
		{#each getComponentsForSlot('header-after') as slotComp (slotComp.id)}
			{@const Component = slotComp.component}
			<Component {...slotComp.props || {}} />
		{/each}

		<div class="mx-auto flex w-full flex-1">
			{#if snbPosition === 'right'}
				<aside
					class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:block"
				>
					<Panel />
				</aside>
			{/if}
			{#if snbPosition === 'left'}
				<aside
					class="bg-background sticky top-12 hidden h-[calc(100vh-3rem)] self-start md:top-16 md:h-[calc(100vh-4rem)] 2xl:block 2xl:!w-[230px]"
				>
					<Sidebar />
				</aside>
			{/if}

			<main class="box-content flex-1 overflow-y-auto pt-1 md:py-5 lg:pe-6 2xl:!px-9">
				<!-- Slot: content-before -->
				{#each getComponentsForSlot('content-before') as slotComp (slotComp.id)}
					{@const Component = slotComp.component}
					<Component {...slotComp.props || {}} />
				{/each}

				{@render children()}

				<!-- Slot: content-after -->
				{#each getComponentsForSlot('content-after') as slotComp (slotComp.id)}
					{@const Component = slotComp.component}
					<Component {...slotComp.props || {}} />
				{/each}
			</main>

			{#if snbPosition === 'right'}
				<aside class="bg-background hidden 2xl:block 2xl:!w-[230px]">
					<Sidebar />
				</aside>
			{/if}

			{#if snbPosition === 'left'}
				<aside
					class="bg-subtle border-border my-5 hidden w-[320px] flex-shrink-0 rounded-md border lg:block"
				>
					<Panel />
				</aside>
			{/if}
		</div>
	</div>

	<!-- 좌우 윙 배너 -->
	{#if showWingBanners}
		<aside
			class="fixed hidden transition-all duration-300 min-[1600px]:block"
			class:top-21={!isBannerUp}
			class:top-6={isBannerUp}
			style="right: calc(50% + 760px);"
		>
			<LeftBanner />
		</aside>
		<aside
			class="fixed hidden transition-all duration-300 min-[1600px]:block"
			class:top-21={!isBannerUp}
			class:top-6={isBannerUp}
			style="left: calc(50% + 760px);"
		>
			<RightBanner />
		</aside>
	{/if}

	<!-- Slot: footer-before -->
	{#each getComponentsForSlot('footer-before') as slotComp (slotComp.id)}
		{@const Component = slotComp.component}
		<Component {...slotComp.props || {}} />
	{/each}

	<Footer />

	<!-- Slot: footer-after -->
	{#each getComponentsForSlot('footer-after') as slotComp (slotComp.id)}
		{@const Component = slotComp.component}
		<Component {...slotComp.props || {}} />
	{/each}

	<!-- 팟캐스트 플레이어 -->
	{#if showPodcastPlayer}
		<PodcastPlayer />
	{/if}
</div>

<style>
	.damoang-default-theme {
		/* 기본 테마 스타일 */
	}
</style>
