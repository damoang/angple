<script lang="ts">
    import StackGame from '$lib/components/features/game/stack-game.svelte';
    import { SeoHead } from '$lib/seo/index.js';
    import { getGame } from '$lib/games/registry.js';

    const game = getGame('stack');
</script>

<SeoHead
    config={{
        meta: { title: game.name, description: game.description },
        og: { title: game.name, type: 'website' }
    }}
/>

<div class="mx-auto max-w-xl px-4 py-6">
    <div class="mb-4">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 text-2xl font-bold">{game.name}</h1>
        <p class="text-muted-foreground text-sm">{game.description}</p>
    </div>
    <StackGame />
</div>
