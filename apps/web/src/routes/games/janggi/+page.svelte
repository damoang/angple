<script lang="ts">
    import JanggiGame from '$lib/components/features/game/janggi-game.svelte';
    import { SeoHead } from '$lib/seo/index.js';
</script>

<SeoHead
    config={{
        meta: { title: '장기', description: 'AI와 대결하는 한국 전통 장기' },
        og: { title: '장기', type: 'website' }
    }}
/>

<div class="mx-auto max-w-3xl px-4 py-8">
    <div class="mb-6">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 text-2xl font-bold">장기</h1>
        <p class="text-muted-foreground text-sm">AI 또는 친구와 한국 전통 장기 대결</p>
    </div>
    <JanggiGame />
</div>
