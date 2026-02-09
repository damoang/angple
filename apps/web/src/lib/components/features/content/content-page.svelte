<script lang="ts">
	import { SeoHead } from '$lib/seo/index.js';
	import type { SeoConfig } from '$lib/seo/types.js';

	interface Props {
		title: string;
		content: string;
		seoConfig?: SeoConfig;
	}

	let { title, content, seoConfig }: Props = $props();

	const defaultSeo: SeoConfig = $derived(
		seoConfig || {
			meta: {
				title,
				description: `${title} - 다모앙`
			},
			og: {
				title,
				type: 'website'
			}
		}
	);
</script>

<SeoHead config={defaultSeo} />

<div class="mx-auto max-w-4xl px-4 py-8">
	<h1 class="text-foreground mb-6 text-3xl font-bold">{title}</h1>
	<div class="prose dark:prose-invert max-w-none">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html content}
	</div>
</div>
