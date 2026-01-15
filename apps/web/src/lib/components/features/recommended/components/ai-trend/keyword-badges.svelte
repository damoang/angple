<script lang="ts">
    import type { AIKeyword } from '$lib/api/types.js';

    let { keywords }: { keywords: AIKeyword[] } = $props();

    // 최대 5개 키워드만 표시
    const displayKeywords = $derived((keywords || []).slice(0, 5));
</script>

<div class="flex flex-wrap gap-1.5" role="list" aria-label="트렌드 키워드">
    {#each displayKeywords as keyword (keyword.name)}
        <span
            class="inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-xs font-medium text-slate-900 transition-colors hover:bg-amber-500 dark:bg-amber-500 dark:text-slate-900"
            role="listitem"
        >
            {keyword.name}
        </span>
    {/each}
</div>
