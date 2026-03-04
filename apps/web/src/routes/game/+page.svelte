<script lang="ts">
    import { SeoHead } from '$lib/seo/index.js';
    import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
    import Crown from '@lucide/svelte/icons/crown';
    import Circle from '@lucide/svelte/icons/circle';
    import Zap from '@lucide/svelte/icons/zap';

    const games = [
        {
            id: 'janggi',
            name: '장기',
            description: 'AI와 대결하는 한국 전통 장기',
            icon: Crown,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50 dark:bg-amber-950/30'
        },
        {
            id: 'omok',
            name: '오목',
            description: '15x15 바둑판 위의 오목 대결',
            icon: Circle,
            color: 'text-stone-700 dark:text-stone-300',
            bgColor: 'bg-stone-50 dark:bg-stone-900/30'
        },
        {
            id: 'snake',
            name: '뱀 게임',
            description: '클래식 스네이크 게임',
            icon: Zap,
            color: 'text-green-600',
            bgColor: 'bg-green-50 dark:bg-green-950/30'
        }
    ];
</script>

<SeoHead
    config={{
        meta: { title: '게임', description: '다모앙 미니게임' },
        og: { title: '게임', type: 'website' }
    }}
/>

<div class="mx-auto max-w-4xl px-4 py-8">
    <div class="mb-8 flex items-center gap-3">
        <Gamepad2 class="text-primary h-8 w-8" />
        <h1 class="text-foreground text-3xl font-bold">미니게임</h1>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each games as game (game.id)}
            <a
                href="/game/{game.id}"
                class="border-border hover:border-primary/50 group block rounded-xl border p-6 transition-all hover:shadow-md {game.bgColor}"
            >
                <div class="mb-3 flex items-center gap-3">
                    <game.icon class="h-6 w-6 {game.color}" />
                    <h2 class="text-foreground text-xl font-semibold">{game.name}</h2>
                </div>
                <p class="text-muted-foreground text-sm">{game.description}</p>
            </a>
        {/each}
    </div>
</div>
