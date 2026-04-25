<script lang="ts">
    import type { Block, ImageBlockData } from '../types.js';

    let { block }: { block: Block<ImageBlockData> } = $props();
</script>

{#if block.data.url}
    <figure class="builder-image">
        <img src={block.data.url} alt={block.data.alt} width={block.data.width} loading="lazy" />
        {#if block.data.caption}
            <figcaption>{block.data.caption}</figcaption>
        {/if}
    </figure>
{/if}

<style>
    .builder-image {
        margin: 1em 0;
    }
    .builder-image img {
        max-width: 100%;
        height: auto;
        display: block;
    }
    .builder-image figcaption {
        font-size: 0.875rem;
        color: #6b7280;
        margin-top: 0.5em;
    }
</style>
