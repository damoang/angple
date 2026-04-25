<script lang="ts">
    import type { Block, HeaderBlockData } from '../types.js';

    let { block }: { block: Block<HeaderBlockData> } = $props();
</script>

{#if block.data.level === 1}
    <h1 id={block.data.anchor} class="builder-header builder-header-1">{block.data.text}</h1>
{:else if block.data.level === 2}
    <h2 id={block.data.anchor} class="builder-header builder-header-2">{block.data.text}</h2>
{:else if block.data.level === 3}
    <h3 id={block.data.anchor} class="builder-header builder-header-3">{block.data.text}</h3>
{:else}
    <h4 id={block.data.anchor} class="builder-header builder-header-4">{block.data.text}</h4>
{/if}

<style>
    .builder-header {
        font-weight: 700;
        line-height: 1.3;
        margin: 1.25em 0 0.5em;
    }
    .builder-header-1 {
        font-size: 2rem;
    }
    .builder-header-2 {
        font-size: 1.5rem;
    }
    .builder-header-3 {
        font-size: 1.25rem;
    }
    .builder-header-4 {
        font-size: 1.1rem;
    }
</style>
