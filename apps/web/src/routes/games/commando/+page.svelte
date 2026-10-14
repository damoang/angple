<script lang="ts">
    import CommandoGame from '$lib/components/features/game/commando-game.svelte';
    import { SeoHead } from '$lib/seo/index.js';
    import { getGame } from '$lib/games/registry.js';

    const game = getGame('commando');
</script>

<SeoHead
    config={{
        meta: { title: game.name, description: game.description },
        og: { title: game.name, type: 'website' }
    }}
/>

<div class="mx-auto max-w-5xl px-4 py-6">
    <div class="mb-4">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 flex items-center gap-2 text-2xl font-bold">
            <span>{game.name}</span>
            {#if game.badge}
                <span
                    class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                    >{game.badge}</span
                >
            {/if}
        </h1>
        <p class="text-muted-foreground text-sm">{game.description}</p>
    </div>
    <CommandoGame />
</div>
