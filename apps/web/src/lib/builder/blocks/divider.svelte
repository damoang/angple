<script lang="ts">
    import type { Block, DividerBlockData } from '../types.js';

    let { block }: { block: Block<DividerBlockData> } = $props();
</script>

{#if block.data.style === 'space'}
    <div class="builder-divider builder-divider-space"></div>
{:else}
    <hr class="builder-divider builder-divider-line" />
{/if}

<style>
    .builder-divider-line {
        border: 0;
        border-top: 1px solid #e5e7eb;
        margin: 1.5em 0;
    }
    .builder-divider-space {
        height: 2em;
    }
</style>
