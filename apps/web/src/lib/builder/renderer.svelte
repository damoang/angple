<script lang="ts">
    import type { BuilderContent } from './types.js';
    import { BLOCK_COMPONENTS } from './blocks/index.js';

    let { content }: { content: BuilderContent } = $props();
</script>

<!--
  SSR-safe content renderer (M1 A1 PoC, RFC §4-2).
  TipTap 의존성 0 — block 별 dumb component 로 HTML 만 출력.
  schema_version mismatch 시에는 콘텐츠를 렌더하지 않음 (silent skip — Phase 2 에서 변환 옵션 추가).
-->
{#if content && content.schema_version === 1}
    <div class="builder-content">
        {#each content.blocks as block (block.id)}
            {@const Component = BLOCK_COMPONENTS[block.type]}
            {#if Component}
                <Component {block} />
            {/if}
        {/each}
    </div>
{/if}

<style>
    .builder-content {
        max-width: 100%;
    }
</style>
