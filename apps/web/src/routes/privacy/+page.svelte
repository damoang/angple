<script lang="ts">
    import ContentPage from '$lib/components/features/content/content-page.svelte';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
</script>

<ContentPage title={data.title} content={data.content} />

<div class="mx-auto max-w-4xl px-4 pb-8">
    <div
        class="text-muted-foreground border-border flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-sm"
    >
        <a href="/privacy/history" class="hover:text-foreground underline underline-offset-4">
            이전 버전 처리방침
        </a>
        <a href="/privacy/compare" class="hover:text-foreground underline underline-offset-4">
            신구 대조표
        </a>
    </div>
</div>
