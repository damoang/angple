<script lang="ts">
    import type { AIKeyword } from '$lib/api/types.js';

    let { keywords }: { keywords: AIKeyword[] } = $props();
</script>

<div class="flex flex-wrap gap-1.5">
    {#each keywords as keyword}
        <span
            class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-200"
        >
            {keyword.name}
        </span>
    {/each}
</div>
