<script lang="ts">
    import OmokGame from '$lib/components/features/game/omok-game.svelte';
    import { SeoHead } from '$lib/seo/index.js';
</script>

<SeoHead
    config={{
        meta: { title: '오목', description: '15x15 바둑판 위의 오목 대결' },
        og: { title: '오목', type: 'website' }
    }}
/>

<div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 text-2xl font-bold">오목</h1>
        <p class="text-muted-foreground text-sm">AI 또는 친구와 오목 대결 (5줄 먼저 만들면 승리)</p>
    </div>
    <OmokGame />
</div>
