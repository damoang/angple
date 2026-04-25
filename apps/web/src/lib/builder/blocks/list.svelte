<script lang="ts">
    import type { Block, ListBlockData } from '../types.js';

    let { block }: { block: Block<ListBlockData> } = $props();
</script>

{#if block.data.style === 'ol'}
    <ol class="builder-list">
        {#each block.data.items as item, idx (idx)}
            <li>{item}</li>
        {/each}
    </ol>
{:else}
    <ul class="builder-list" class:checklist={block.data.checklist}>
        {#each block.data.items as item, idx (idx)}
            <li>
                {#if block.data.checklist}<input type="checkbox" disabled />{/if}
                {item}
            </li>
        {/each}
    </ul>
{/if}

<style>
    .builder-list {
        line-height: 1.7;
        margin: 0.75em 0;
        padding-left: 1.5em;
    }
    .builder-list.checklist {
        list-style: none;
        padding-left: 0;
    }
    .builder-list.checklist li {
        display: flex;
        gap: 0.5em;
        align-items: center;
    }
</style>
