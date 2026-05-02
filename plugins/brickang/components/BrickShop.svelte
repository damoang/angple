<!--
  BrickShop.svelte — 메인 진입.
  - 진행률 ProgressBar
  - 등급 카드
  - 결제 버튼 → PaymentModal
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { brickStore } from '../stores/brick.svelte.js';
    import { buildingStore } from '../stores/building.svelte.js';
    import ProgressBar from './ProgressBar.svelte';
    import BrickCard from './BrickCard.svelte';
    import Building2D from './Building2D.svelte';
    import PaymentModal from './PaymentModal.svelte';

    interface Props {
        defaultBuildingId?: number;
    }
    let { defaultBuildingId = 1 }: Props = $props();

    let modalOpen = $state(false);

    onMount(async () => {
        await Promise.all([brickStore.load(), buildingStore.loadActive()]);
    });

    function handleComplete() {
        // confirm 후 active 재조회 (current_bricks + recent 갱신)
        void buildingStore.loadActive();
    }

    let activeBuildingId = $derived(buildingStore.building?.id ?? defaultBuildingId);
</script>

<section class="brick-shop">
    <h1 class="brick-shop__title">브릭앙 — 벽돌한장의 마음을 쌓다</h1>

    {#if buildingStore.loading}
        <p>로딩 중…</p>
    {:else if buildingStore.building}
        <ProgressBar
            current={buildingStore.building.current_bricks}
            target={buildingStore.building.target_bricks}
            label={buildingStore.building.name}
        />

        <div class="brick-shop__viewer">
            <Building2D building={buildingStore.building} bricks={buildingStore.bricks} />
        </div>
    {:else}
        <p>활성 건축물이 없습니다.</p>
    {/if}

    <h2>등급 선택</h2>
    <div class="brick-shop__cards">
        {#each brickStore.brickTypes as t (t.id)}
            <BrickCard
                brickType={t}
                selected={brickStore.selectedSlug === t.slug}
                onselect={(slug) => brickStore.select(slug)}
            />
        {/each}
    </div>

    <button
        type="button"
        class="brick-shop__cta"
        disabled={!brickStore.selected}
        onclick={() => (modalOpen = true)}
    >
        벽돌 놓기
    </button>

    <PaymentModal
        bind:open={modalOpen}
        buildingId={activeBuildingId}
        onclose={() => (modalOpen = false)}
        oncomplete={handleComplete}
    />
</section>

<style>
    .brick-shop {
        max-width: 900px;
        margin: 0 auto;
        padding: 1.5rem;
    }
    .brick-shop__title {
        margin-bottom: 1.5rem;
    }
    .brick-shop__viewer {
        margin: 1.5rem 0;
        text-align: center;
    }
    .brick-shop__cards {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin: 1rem 0;
    }
    .brick-shop__cta {
        display: block;
        width: 100%;
        padding: 1rem;
        font-size: 1.1rem;
        background: #c84c32;
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
    }
    .brick-shop__cta:disabled {
        background: #aaa;
        cursor: not-allowed;
    }
</style>
