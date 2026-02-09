<script lang="ts">
	import ContentPage from '$lib/components/features/content/content-page.svelte';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();
</script>

<ContentPage title={data.title} content={data.content} />
