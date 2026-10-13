<script lang="ts">
    /**
     * 뱀 게임 랭킹 카드 — 「이번 주」·「전체」 상위 10 (공개 GET /stack-ws/leaderboard, 닉네임만).
     * 표는 앙쌓기 점수판 표를 같이 쓴다. 각 표는 처음 열 때 한 번, 기록이 반영된 뒤(refresh 가 오를 때)
     * 지금 보고 있는 표만 다시 불러온다. 주기적으로 다시 부르지 않는다(서버·CDN 60초 캐시).
     */
    import { untrack } from 'svelte';
    import StackLeaderboardTable from './stack-leaderboard-table.svelte';
    import {
        fetchLeaderboard,
        type BoardId,
        type ScoreRow,
        type VersusRow
    } from '$lib/games/stack/leaderboard.js';

    let {
        refresh = 0
    }: {
        /** 기록이 점수판에 들어갈 때마다 1씩 올린다 */
        refresh?: number;
    } = $props();

    type Loaded =
        | { state: 'loading' }
        | { state: 'error' }
        | { state: 'ok'; rows: Array<ScoreRow | VersusRow>; at: number };

    const BOARDS: Array<{ id: BoardId; label: string }> = [
        { id: 'snake_week', label: '이번 주' },
        { id: 'snake_all', label: '전체' }
    ];

    let current = $state<BoardId>('snake_week');
    let boards = $state<Partial<Record<BoardId, Loaded>>>({});
    /** 늦게 온 응답이 새 응답을 덮지 않게 — 표마다 */
    const gens: Partial<Record<BoardId, number>> = {};

    const view = $derived(boards[current]);

    async function load(id: BoardId, fresh: boolean) {
        const my = (gens[id] = (gens[id] ?? 0) + 1);
        const prev = boards[id];
        if (!prev || prev.state !== 'ok') boards[id] = { state: 'loading' };
        try {
            const data = await fetchLeaderboard(id, { fresh });
            if (my === gens[id]) boards[id] = { state: 'ok', rows: data.rows, at: Date.now() };
        } catch {
            // 이미 표가 있으면 그대로 둔다
            const now = boards[id];
            if (my === gens[id] && (!now || now.state !== 'ok')) boards[id] = { state: 'error' };
        }
    }

    function select(id: BoardId) {
        current = id;
        if (!boards[id]) void load(id, false);
    }

    function retry() {
        delete boards[current];
        void load(current, false);
    }

    // 처음 한 번 — 기본 표(이번 주)만
    $effect(() =>
        untrack(() => {
            void load('snake_week', false);
        })
    );

    // 기록이 반영된 뒤 — 보고 있는 표는 바로, 나머지 표는 다음에 열 때 새로 불러온다
    $effect(() => {
        if (refresh > 0) {
            untrack(() => {
                for (const b of BOARDS) if (b.id !== current) delete boards[b.id];
                void load(current, true);
            });
        }
    });
</script>

<section class="w-full space-y-3 rounded-lg border p-4" aria-label="뱀 게임 랭킹">
    <div class="flex items-center justify-between gap-2">
        <h2 class="text-foreground text-sm font-semibold">랭킹</h2>
        <div class="flex gap-1 rounded-lg border p-1" role="tablist" aria-label="랭킹 기간">
            {#each BOARDS as b (b.id)}
                <button
                    type="button"
                    role="tab"
                    aria-selected={current === b.id}
                    class="rounded-md px-3 py-1 text-xs {current === b.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'}"
                    onclick={() => select(b.id)}
                >
                    {b.label}
                </button>
            {/each}
        </div>
    </div>

    <p class="text-muted-foreground text-xs">
        {#if current === 'snake_week'}
            이번 주 최고 점수 TOP 10 (월요일 0시에 새로 시작, 한국 시간)
        {:else}
            역대 최고 점수 TOP 10 (한 사람당 최고 기록 하나, 한국 시간)
        {/if}
    </p>

    {#if !view || view.state === 'loading'}
        <p class="text-muted-foreground text-sm">불러오는 중…</p>
    {:else if view.state === 'error'}
        <div class="flex items-center gap-2">
            <p class="text-muted-foreground text-sm">랭킹을 불러오지 못했습니다.</p>
            <button type="button" class="text-primary text-sm underline" onclick={retry}
                >다시 시도</button
            >
        </div>
    {:else if view.rows.length === 0}
        <p class="text-muted-foreground text-sm">
            아직 기록이 없습니다. 로그인하고 첫 기록을 남겨 보세요!
        </p>
    {:else}
        <StackLeaderboardTable rows={view.rows} now={view.at} />
    {/if}
</section>
