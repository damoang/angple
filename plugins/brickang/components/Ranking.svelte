<!--
  Ranking.svelte — 브릭앙 랭킹.
  - 탭: 전체(all) / 월간(monthly) / 건축물별(building)
  - 표시: 순위, 닉네임, 벽돌 수, 누적 금액
  - Svelte 5 Rune 모드
-->
<script lang="ts">
    import { onMount } from 'svelte';
    import { brickangApi, type BuildingDto } from '../lib/api.js';

    type Tab = 'all' | 'monthly' | 'building';

    interface RankingRow {
        rank: number;
        user_id: number;
        nickname: string;
        bricks: number;
        spent_krw: number;
    }

    let tab = $state<Tab>('all');
    let buildings = $state<BuildingDto[]>([]);
    let selectedBuildingId = $state<number | null>(null);

    let allRows = $state<RankingRow[]>([]);
    let monthlyRows = $state<RankingRow[]>([]);
    let buildingRows = $state<RankingRow[]>([]);

    let loading = $state(false);
    let error = $state<string | null>(null);

    interface AllOrMonthlyResponse {
        rankings: Array<{
            rank: number;
            user_id: number;
            nickname: string;
            total_bricks: number;
            total_spent_krw: number;
        }>;
    }

    interface BuildingRankResponse {
        building_id: number;
        rankings: RankingRow[];
    }

    async function loadAll(): Promise<void> {
        loading = true;
        error = null;
        try {
            const res = (await brickangApi.getRankingsAll(50)) as AllOrMonthlyResponse;
            allRows = res.rankings.map((r) => ({
                rank: r.rank,
                user_id: r.user_id,
                nickname: r.nickname,
                bricks: r.total_bricks,
                spent_krw: r.total_spent_krw
            }));
        } catch (err) {
            error = err instanceof Error ? err.message : '불러오기 실패';
        } finally {
            loading = false;
        }
    }

    async function loadMonthly(): Promise<void> {
        loading = true;
        error = null;
        try {
            const res = (await brickangApi.getRankingsMonthly(50)) as AllOrMonthlyResponse;
            monthlyRows = res.rankings.map((r) => ({
                rank: r.rank,
                user_id: r.user_id,
                nickname: r.nickname,
                bricks: r.total_bricks,
                spent_krw: r.total_spent_krw
            }));
        } catch (err) {
            error = err instanceof Error ? err.message : '불러오기 실패';
        } finally {
            loading = false;
        }
    }

    async function loadBuildings(): Promise<void> {
        try {
            const res = await brickangApi.listBuildings();
            buildings = res.buildings;
            if (!selectedBuildingId && buildings.length > 0) {
                selectedBuildingId = buildings[0].id;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : '건축물 로드 실패';
        }
    }

    async function loadBuildingRanking(id: number): Promise<void> {
        loading = true;
        error = null;
        try {
            const res = (await brickangApi.getBuildingRankings(id, 30)) as BuildingRankResponse;
            buildingRows = res.rankings;
        } catch (err) {
            error = err instanceof Error ? err.message : '불러오기 실패';
        } finally {
            loading = false;
        }
    }

    onMount(async () => {
        await Promise.all([loadAll(), loadBuildings()]);
    });

    function setTab(t: Tab): void {
        tab = t;
        if (t === 'monthly' && monthlyRows.length === 0) void loadMonthly();
        if (t === 'building' && selectedBuildingId && buildingRows.length === 0) {
            void loadBuildingRanking(selectedBuildingId);
        }
    }

    function onBuildingChange(): void {
        if (selectedBuildingId) void loadBuildingRanking(selectedBuildingId);
    }

    const currentRows = $derived(
        tab === 'all' ? allRows : tab === 'monthly' ? monthlyRows : buildingRows
    );

    function fmtKrw(n: number): string {
        return n.toLocaleString('ko-KR');
    }
</script>

<section class="ranking">
    <h2 class="ranking__title">브릭앙 랭킹</h2>

    <div class="ranking__tabs" role="tablist">
        <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            class="ranking__tab"
            class:ranking__tab--active={tab === 'all'}
            onclick={() => setTab('all')}
        >
            전체
        </button>
        <button
            type="button"
            role="tab"
            aria-selected={tab === 'monthly'}
            class="ranking__tab"
            class:ranking__tab--active={tab === 'monthly'}
            onclick={() => setTab('monthly')}
        >
            월간
        </button>
        <button
            type="button"
            role="tab"
            aria-selected={tab === 'building'}
            class="ranking__tab"
            class:ranking__tab--active={tab === 'building'}
            onclick={() => setTab('building')}
        >
            건축물별
        </button>
    </div>

    {#if tab === 'building'}
        <div class="ranking__building-select">
            <label for="brickang-ranking-building">건축물 선택</label>
            <select
                id="brickang-ranking-building"
                bind:value={selectedBuildingId}
                onchange={onBuildingChange}
            >
                {#each buildings as b (b.id)}
                    <option value={b.id}>#{b.id} — {b.name}</option>
                {/each}
            </select>
        </div>
    {/if}

    {#if loading}
        <p class="ranking__empty">불러오는 중…</p>
    {:else if error}
        <p class="ranking__error">에러: {error}</p>
    {:else if currentRows.length === 0}
        <p class="ranking__empty">랭킹 데이터가 없습니다.</p>
    {:else}
        <div class="ranking__table-wrap">
            <table class="ranking__table">
                <thead>
                    <tr>
                        <th class="ranking__col-rank">순위</th>
                        <th>닉네임</th>
                        <th class="ranking__col-num">벽돌 수</th>
                        <th class="ranking__col-num">누적 금액</th>
                    </tr>
                </thead>
                <tbody>
                    {#each currentRows as r (r.user_id + ':' + r.rank)}
                        <tr class:ranking__row--top={r.rank <= 3}>
                            <td class="ranking__col-rank">{r.rank}</td>
                            <td>{r.nickname}</td>
                            <td class="ranking__col-num">{r.bricks.toLocaleString('ko-KR')}</td>
                            <td class="ranking__col-num">₩{fmtKrw(r.spent_krw)}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</section>

<style>
    .ranking {
        max-width: 720px;
        margin: 0 auto;
        padding: 1.5rem 1rem;
    }
    .ranking__title {
        font-size: 1.5rem;
        font-weight: 700;
        margin-bottom: 1rem;
    }
    .ranking__tabs {
        display: flex;
        gap: 0.25rem;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 1rem;
    }
    .ranking__tab {
        padding: 0.5rem 1rem;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        font-size: 0.875rem;
        color: #6b7280;
    }
    .ranking__tab--active {
        color: #111827;
        border-bottom-color: #2563eb;
        font-weight: 600;
    }
    .ranking__building-select {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        margin-bottom: 1rem;
        font-size: 0.875rem;
    }
    .ranking__building-select select {
        padding: 0.25rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
    }
    .ranking__empty,
    .ranking__error {
        padding: 1.5rem;
        text-align: center;
        color: #6b7280;
    }
    .ranking__error {
        color: #dc2626;
    }
    .ranking__table-wrap {
        overflow-x: auto;
    }
    .ranking__table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
    }
    .ranking__table th,
    .ranking__table td {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #e5e7eb;
        text-align: left;
    }
    .ranking__table th {
        font-weight: 600;
        background-color: #f9fafb;
        color: #374151;
    }
    .ranking__col-rank {
        width: 4rem;
        text-align: center;
    }
    .ranking__col-num {
        text-align: right;
        white-space: nowrap;
    }
    .ranking__row--top td {
        font-weight: 600;
        background-color: #fef9c3;
    }
</style>
