<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
</script>

<header class="border-b border-gray-100">
	<div class="container mx-auto max-w-3xl px-4">
		<div class="flex h-20 items-center justify-between">
			<!-- Logo -->
			<div class="flex items-center gap-3">
				<div class="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400"></div>
				<h1 class="text-2xl font-light tracking-tight text-gray-900">Minimal</h1>
			</div>

			<!-- Simple Nav -->
			<nav class="flex gap-8 text-sm">
				<a href="/" class="text-gray-600 transition hover:text-emerald-600">Home</a>
				<a href="/free" class="text-gray-600 transition hover:text-cyan-600">Posts</a>
			</nav>
		</div>
	</div>
</header>
