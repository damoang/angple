<!--
  BuildingViewer.svelte — 2D ↔ 3D 토글 뷰어.
  - 데스크톱 기본: 3D
  - 모바일 (touch + 작은 화면): 2D 자동 fallback (Three.js 부담 회피)
  - props.mode='place' 시 onPositionPick 콜백을 자식에 전달 (3D 만 지원, 2D 는 read-only)
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import Building2D from './Building2D.svelte';
    import type { BrickDto, BuildingDto } from '../lib/api.js';
    import type { BrickTypeSlug } from '../types/index.js';

    interface Props {
        building: BuildingDto;
        bricks: BrickDto[];
        mode?: 'view' | 'place';
        placingType?: BrickTypeSlug;
        onPositionPick?: (pos: { x: number; y: number; z: number }) => void;
    }

    let {
        building,
        bricks,
        mode = 'view',
        placingType = 'silver',
        onPositionPick
    }: Props = $props();

    let viewerKind = $state<'2d' | '3d'>('2d');
    let isMobile = $state(false);

    onMount(() => {
        // 모바일/저사양 감지: 좁은 화면 OR coarse pointer
        const mql = window.matchMedia('(max-width: 768px), (pointer: coarse)');
        isMobile = mql.matches;
        // 데스크톱 기본 3D, 모바일 기본 2D
        viewerKind = isMobile ? '2d' : '3d';
    });

    function toggle() {
        viewerKind = viewerKind === '2d' ? '3d' : '2d';
    }
</script>

<div class="viewer-wrap">
    <div class="toolbar">
        <button class="toggle" onclick={toggle} aria-label="뷰 전환">
            {viewerKind === '2d' ? '3D 보기' : '2D 보기'}
        </button>
        {#if mode === 'place' && viewerKind === '2d'}
            <span class="hint">자유 배치는 3D 모드에서만 가능합니다</span>
        {/if}
    </div>

    {#if viewerKind === '3d'}
        {#await import('./Building3D.svelte') then mod}
            <mod.default {building} {bricks} {mode} {placingType} {onPositionPick} />
        {:catch err}
            <p class="error">3D 로드 실패: {err.message}</p>
        {/await}
    {:else}
        <Building2D {building} {bricks} />
    {/if}
</div>

<style>
    .viewer-wrap {
        width: 100%;
    }
    .toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 8px;
    }
    .toggle {
        padding: 4px 10px;
        background: #283050;
        color: #fff;
        border: 1px solid #4060a0;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    .toggle:hover {
        background: #344070;
    }
    .hint {
        font-size: 12px;
        color: #888;
    }
    .error {
        color: #c33;
    }
</style>
