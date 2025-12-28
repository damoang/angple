<script lang="ts">
	import { authStore } from '$lib/stores/auth.svelte';
</script>

<header class="bg-white shadow-md">
	<div class="container mx-auto max-w-4xl px-4">
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<div class="flex items-center gap-2">
				<div
					class="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-pink-500"
				></div>
				<h1 class="bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent">
					Colorful Blog
				</h1>
			</div>

			<!-- Navigation -->
			<nav class="flex gap-6">
				<a href="/" class="text-gray-700 transition hover:text-orange-600">Home</a>
				<a href="/free" class="text-gray-700 transition hover:text-pink-600">Posts</a>
				<a href="/about" class="text-gray-700 transition hover:text-orange-600">About</a>
			</nav>
		</div>
	</div>
</header>
