<script lang="ts">
    import SnakeGame from '$lib/components/features/game/snake-game.svelte';
    import { SeoHead } from '$lib/seo/index.js';
</script>

<SeoHead
    config={{
        meta: { title: '뱀 게임', description: '클래식 스네이크 게임' },
        og: { title: '뱀 게임', type: 'website' }
    }}
/>

<div class="mx-auto max-w-xl px-4 py-8">
    <div class="mb-6">
        <a href="/games" class="text-muted-foreground hover:text-foreground text-sm">← 게임 목록</a>
        <h1 class="text-foreground mt-2 text-2xl font-bold">뱀 게임</h1>
        <p class="text-muted-foreground text-sm">먹이를 먹으며 길어지는 클래식 스네이크</p>
    </div>
    <SnakeGame />
</div>
