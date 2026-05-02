<script lang="ts">
    import { onMount } from 'svelte';
    import BuildingViewer from '../../../../../../../plugins/brickang/components/BuildingViewer.svelte';
    import {
        brickangApi,
        type BrickDto,
        type BuildingDto
    } from '../../../../../../../plugins/brickang/lib/api.js';
    import type { PageData } from './$types.js';

    interface Props {
        data: PageData;
    }
    let { data }: Props = $props();

    let building = $state<BuildingDto | null>(null);
    let bricks = $state<BrickDto[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    onMount(async () => {
        try {
            const [b, br] = await Promise.all([
                brickangApi.getBuilding(data.buildingId),
                brickangApi.getBuildingBricks(data.buildingId, { limit: 500 })
            ]);
            building = b;
            bricks = br.bricks;
        } catch (err) {
            error = err instanceof Error ? err.message : '건축물 로드 실패';
        } finally {
            loading = false;
        }
    });
</script>

<svelte:head>
    <title>건축물 #{data.buildingId} — 브릭앙</title>
</svelte:head>

<section class="brickang-building">
    {#if loading}
        <p class="brickang-building__msg">불러오는 중…</p>
    {:else if error}
        <p class="brickang-building__msg brickang-building__msg--error">에러: {error}</p>
    {:else if building}
        <header class="brickang-building__header">
            <h1>{building.name}</h1>
            {#if building.description}
                <p class="brickang-building__desc">{building.description}</p>
            {/if}
            <p class="brickang-building__progress">
                {building.current_bricks.toLocaleString('ko-KR')} /
                {building.target_bricks.toLocaleString('ko-KR')} 장 ({building.progress_percent.toFixed(
                    1
                )}%)
            </p>
        </header>
        <BuildingViewer {building} {bricks} mode="view" />
    {:else}
        <p class="brickang-building__msg">건축물을 찾을 수 없습니다.</p>
    {/if}
</section>

<style>
    .brickang-building {
        max-width: 960px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
    }
    .brickang-building__header {
        margin-bottom: 1rem;
    }
    .brickang-building__header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0 0 0.25rem;
    }
    .brickang-building__desc {
        color: #6b7280;
        font-size: 0.875rem;
        margin: 0 0 0.5rem;
    }
    .brickang-building__progress {
        font-size: 0.875rem;
        color: #374151;
        margin: 0;
    }
    .brickang-building__msg {
        padding: 2rem 1rem;
        text-align: center;
        color: #6b7280;
    }
    .brickang-building__msg--error {
        color: #dc2626;
    }
</style>
