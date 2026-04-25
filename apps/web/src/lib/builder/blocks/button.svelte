<script lang="ts">
    import type { Block, ButtonBlockData } from '../types.js';

    let { block }: { block: Block<ButtonBlockData> } = $props();
</script>

<a class="builder-button builder-button-{block.data.variant}" href={block.data.href}>
    {block.data.text}
</a>

<style>
    .builder-button {
        display: inline-block;
        padding: 0.5em 1.25em;
        border-radius: 0.375rem;
        text-decoration: none;
        font-weight: 600;
    }
    .builder-button-primary {
        background: #3b82f6;
        color: #fff;
    }
    .builder-button-secondary {
        background: #e5e7eb;
        color: #1f2937;
    }
    .builder-button-link {
        background: transparent;
        color: #3b82f6;
        text-decoration: underline;
    }
</style>
