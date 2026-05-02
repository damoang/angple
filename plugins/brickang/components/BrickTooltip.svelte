<!--
  BrickTooltip.svelte — 호버 시 닉네임/메시지 표시.
  익명 등급은 메시지 영역 미노출.
-->
<script lang="ts">
    import type { BrickDto } from '../lib/api.js';

    interface Props {
        brick: BrickDto;
        x: number;
        y: number;
    }
    let { brick, x, y }: Props = $props();

    let isAnonymous = $derived(brick.brick_type_slug === 'anonymous');
</script>

<div class="tooltip" style="left: {x}px; top: {y}px;">
    <div class="tooltip__nickname">{brick.nickname}</div>
    {#if !isAnonymous && brick.message}
        <div class="tooltip__message">"{brick.message}"</div>
    {/if}
    <div class="tooltip__meta">
        {brick.brick_type_slug} · {new Date(brick.placed_at).toLocaleDateString('ko-KR')}
    </div>
</div>

<style>
    .tooltip {
        position: fixed;
        pointer-events: none;
        background: rgba(0, 0, 0, 0.85);
        color: #fff;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.85rem;
        z-index: 1000;
        max-width: 240px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .tooltip__nickname {
        font-weight: 600;
        margin-bottom: 0.25rem;
    }
    .tooltip__message {
        font-style: italic;
        margin-bottom: 0.25rem;
        word-break: break-word;
    }
    .tooltip__meta {
        font-size: 0.7rem;
        opacity: 0.7;
    }
</style>
