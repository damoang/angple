<script lang="ts">
    import type { Block, EmbedBlockData } from '../types.js';

    let { block }: { block: Block<EmbedBlockData> } = $props();

    function youtubeId(source: string): string | null {
        const m = source.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
        return m ? m[1] : null;
    }
</script>

{#if block.data.provider === 'youtube'}
    {@const id = youtubeId(block.data.source)}
    {#if id}
        <div class="builder-embed builder-embed-youtube">
            <iframe
                src="https://www.youtube.com/embed/{id}"
                title="YouTube embed"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        </div>
    {/if}
{:else if block.data.provider === 'twitter'}
    <blockquote class="builder-embed builder-embed-twitter">
        <a href={block.data.source} target="_blank" rel="noopener noreferrer">
            {block.data.source}
        </a>
    </blockquote>
{:else if block.data.provider === 'map'}
    <div class="builder-embed builder-embed-map">
        <a href={block.data.source} target="_blank" rel="noopener noreferrer">{block.data.source}</a
        >
    </div>
{/if}

<style>
    .builder-embed {
        margin: 1em 0;
    }
    .builder-embed-youtube {
        position: relative;
        padding-bottom: 56.25%;
        height: 0;
    }
    .builder-embed-youtube iframe {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: 0;
    }
</style>
