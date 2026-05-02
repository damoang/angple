<!--
  BrickCard.svelte — 등급 카드.
-->
<script lang="ts">
    import type { BrickTypeDto } from '../lib/api.js';

    interface Props {
        brickType: BrickTypeDto;
        selected?: boolean;
        onselect?: (slug: string) => void;
    }
    let { brickType, selected = false, onselect }: Props = $props();
</script>

<button
    type="button"
    class="brick-card {selected ? 'brick-card--selected' : ''}"
    style="--brick-color: {brickType.color_hex};"
    onclick={() => onselect?.(brickType.slug)}
>
    <div class="brick-card__swatch" class:brick-card__swatch--glow={brickType.glow_effect}></div>
    <div class="brick-card__name">{brickType.name}</div>
    <div class="brick-card__price">
        {brickType.price_krw.toLocaleString()}원
    </div>
    {#if brickType.is_anonymous}
        <div class="brick-card__tag">익명 / 메시지 X</div>
    {/if}
</button>

<style>
    .brick-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
        border: 2px solid #ddd;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        min-width: 110px;
        transition:
            border-color 0.15s,
            transform 0.15s;
    }
    .brick-card:hover {
        border-color: var(--brick-color);
        transform: translateY(-2px);
    }
    .brick-card--selected {
        border-color: var(--brick-color);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--brick-color) 30%, transparent);
    }
    .brick-card__swatch {
        width: 50px;
        height: 30px;
        background: var(--brick-color);
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.1);
    }
    .brick-card__swatch--glow {
        box-shadow: 0 0 12px var(--brick-color);
    }
    .brick-card__name {
        font-weight: 600;
        font-size: 0.95rem;
    }
    .brick-card__price {
        font-size: 0.85rem;
        color: #555;
    }
    .brick-card__tag {
        font-size: 0.7rem;
        color: #999;
    }
</style>
