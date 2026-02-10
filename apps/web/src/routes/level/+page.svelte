<script lang="ts">
    import ContentPage from '$lib/components/features/content/content-page.svelte';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    // 레벨 뱃지 목록 생성 (0~109)
    const levels = Array.from({ length: 110 }, (_, i) => i);
</script>

<ContentPage title={data.title} content={data.content} />

<!-- 레벨 뱃지 갤러리 -->
<div class="mx-auto mt-8 max-w-4xl px-4">
    <h2 class="text-foreground mb-4 text-lg font-semibold">레벨 뱃지 목록</h2>
    <div class="grid grid-cols-5 gap-3 sm:grid-cols-8 md:grid-cols-10">
        {#each levels as level (level)}
            <div class="border-border flex flex-col items-center gap-1 rounded-md border p-2">
                <LevelBadge {level} size="md" />
                <span class="text-muted-foreground text-xs">Lv.{level}</span>
            </div>
        {/each}
    </div>
</div>
