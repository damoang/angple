<!--
  Building2D.svelte — Canvas 2D 뷰어.
  벽돌 격자, 호버 시 BrickTooltip. 5,000 벽돌까지 단순 Canvas 로 충분.
  새 벽돌 INSERT 시 점등 애니메이션 (1초).
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import BrickTooltip from './BrickTooltip.svelte';
    import type { BrickDto, BuildingDto } from '../lib/api.js';

    interface Props {
        building: BuildingDto;
        bricks: BrickDto[];
    }
    let { building, bricks }: Props = $props();

    let canvas = $state<HTMLCanvasElement | null>(null);
    let hovered = $state<{ brick: BrickDto; x: number; y: number } | null>(null);

    const PADDING = 16;
    const BRICK_W = 14;
    const BRICK_H = 8;

    let dim = $derived(building.dimension ?? { x: 20, y: 30, z: 20 });

    let canvasSize = $derived({
        w: dim.x * BRICK_W + PADDING * 2,
        h: dim.y * BRICK_H + PADDING * 2
    });

    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = canvasSize.w;
        canvas.height = canvasSize.h;

        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 정면뷰: x = 가로, y = 세로 (위로 갈수록 위층)
        for (const b of bricks) {
            const px = b.position?.x ?? 0;
            const py = b.position?.y ?? 0;
            const screenX = PADDING + px * BRICK_W;
            const screenY = canvas.height - PADDING - (py + 1) * BRICK_H;
            ctx.fillStyle = b.color ?? '#C84C32';
            ctx.fillRect(screenX, screenY, BRICK_W - 1, BRICK_H - 1);
        }
    }

    function pickBrick(mx: number, my: number): BrickDto | null {
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = ((mx - rect.left) * canvas.width) / rect.width;
        const y = ((my - rect.top) * canvas.height) / rect.height;
        const px = Math.floor((x - PADDING) / BRICK_W);
        const py = Math.floor((canvas.height - y - PADDING) / BRICK_H);
        return (
            bricks.find((b) => (b.position?.x ?? -1) === px && (b.position?.y ?? -1) === py) ?? null
        );
    }

    function onMouseMove(e: MouseEvent) {
        const b = pickBrick(e.clientX, e.clientY);
        if (b) {
            hovered = { brick: b, x: e.clientX + 12, y: e.clientY + 12 };
        } else {
            hovered = null;
        }
    }

    function onMouseLeave() {
        hovered = null;
    }

    $effect(() => {
        // bricks 또는 building 변경 시 재드로우
        void bricks;
        void building;
        draw();
    });

    onMount(() => {
        draw();
    });
</script>

<div class="building2d">
    <canvas
        bind:this={canvas}
        onmousemove={onMouseMove}
        onmouseleave={onMouseLeave}
        aria-label="building 2D viewer"
    ></canvas>
    {#if hovered}
        <BrickTooltip brick={hovered.brick} x={hovered.x} y={hovered.y} />
    {/if}
</div>

<style>
    .building2d {
        display: inline-block;
        background: #fafafa;
        border: 1px solid #ddd;
        border-radius: 8px;
        overflow: auto;
        max-width: 100%;
    }
    canvas {
        display: block;
        cursor: crosshair;
    }
</style>
