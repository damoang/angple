<script lang="ts">
    import type { Block, ParagraphBlockData } from '../types.js';

    let { block }: { block: Block<ParagraphBlockData> } = $props();
</script>

<!--
  paragraph 은 author-trusted HTML 또는 markdown 을 보관.
  PoC 시점: HTML 만 지원. server-side sanitization 은 service 계층에서.
  client/SSR 모두 @html 로 출력 — XSS 방지는 backend validateBlocks() 에서.
-->
{#if block.data.format === 'html'}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="builder-paragraph">{@html block.data.text}</div>
{:else}
    <pre class="builder-paragraph builder-paragraph-md">{block.data.text}</pre>
{/if}

<style>
    .builder-paragraph {
        line-height: 1.7;
        margin: 0.75em 0;
    }
    .builder-paragraph-md {
        font-family: inherit;
        white-space: pre-wrap;
    }
</style>
