<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
</script>

<header class="border-b border-gray-200 bg-white shadow-sm">
	<div class="container mx-auto px-4">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<div class="flex items-center gap-2">
				<div class="h-8 w-8 rounded bg-gradient-to-br from-emerald-500 to-blue-500"></div>
				<h1 class="text-xl font-bold text-gray-900">다모앙</h1>
			</div>

			<!-- Navigation -->
			<nav class="hidden space-x-6 md:flex">
				<a href="/" class="text-gray-700 hover:text-emerald-600">홈</a>
				<a href="/free" class="text-gray-700 hover:text-emerald-600">자유게시판</a>
				<a href="/notice" class="text-gray-700 hover:text-emerald-600">공지사항</a>
			</nav>

			<!-- User Menu -->
			<div class="flex items-center gap-4">
				{#if authStore.isAuthenticated}
					<span class="text-sm text-gray-700">{authStore.user?.name}님</span>
					<button class="rounded bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300">
						로그아웃
					</button>
				{:else}
					<button class="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">
						로그인
					</button>
				{/if}
			</div>
		</div>
	</div>
</header>
