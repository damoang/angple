<script lang="ts">
    /**
     * 게임 점수 순위 카드(공용) — 「이번 주」·「전체」 상위 10 (공개 GET /api/games/[game]/leaderboard, 닉네임만).
     * 뱀 게임 순위 카드를 게임 이름·변형을 받도록 일반화한 것. 표는 앙쌓기 점수판 표를 같이 쓴다.
     * 각 표는 처음 열 때 한 번, 기록이 반영된 뒤(refresh 가 오를 때) 지금 보고 있는 표만 다시 불러온다.
     * 내 순위는 마지막으로 낸 기록의 결과(standing)로 보여 준다. 비로그인은 로그인 안내.
     */
    import { untrack } from 'svelte';
    import StackLeaderboardTable from './stack-leaderboard-table.svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import {
        fetchScoreBoard,
        type ScoreBoardRow,
        type ScoreFinishResult
    } from '$lib/games/score-ranking.js';

    type Period = 'week' | 'all';

    let {
        game,
        variant = '',
        title = '랭킹',
        refresh = 0,
        standing = null,
        loginHref = '/login'
    }: {
        /** 등록부의 게임 id (예: breakout) */
        game: string;
        variant?: string;
        title?: string;
        /** 기록이 순위에 들어갈 때마다 1씩 올린다 */
        refresh?: number;
        /** 마지막으로 낸 기록의 결과 — 내 순위 줄 */
        standing?: ScoreFinishResult | null;
        /** 비로그인 안내 링크 */
        loginHref?: string;
    } = $props();

    type Loaded =
        | { state: 'loading' }
        | { state: 'error' }
        | { state: 'not_ready' }
        | { state: 'ok'; rows: ScoreBoardRow[]; at: number };

    const PERIODS: Array<{ id: Period; label: string }> = [
        { id: 'week', label: '이번 주' },
        { id: 'all', label: '전체' }
    ];

    let current = $state<Period>('week');
    let boards = $state<Partial<Record<Period, Loaded>>>({});
    /** 늦게 온 응답이 새 응답을 덮지 않게 — 표마다 */
    const gens: Partial<Record<Period, number>> = {};

    const view = $derived(boards[current]);
    /** 내 기록 한 줄 — 「내 기록 · 최고 x점 · 이번 주 n위」 */
    const myLine = $derived(
        standing
            ? [
                  '내 기록',
                  standing.best !== null ? `최고 ${standing.best.toLocaleString()}점` : '',
                  standing.rankWeek ? `이번 주 ${standing.rankWeek}위` : ''
              ]
                  .filter(Boolean)
                  .join(' · ')
            : ''
    );

    async function load(id: Period, fresh: boolean) {
        const my = (gens[id] = (gens[id] ?? 0) + 1);
        const prev = boards[id];
        if (!prev || prev.state !== 'ok') boards[id] = { state: 'loading' };
        try {
            const data = await fetchScoreBoard(game, id, { variant, fresh });
            if (my !== gens[id]) return;
            boards[id] = data.ready
                ? { state: 'ok', rows: data.rows, at: Date.now() }
                : { state: 'not_ready' };
        } catch {
            // 이미 표가 있으면 그대로 둔다
            const now = boards[id];
            if (my === gens[id] && (!now || now.state !== 'ok')) boards[id] = { state: 'error' };
        }
    }

    function select(id: Period) {
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
            void load('week', false);
        })
    );

    // 기록이 반영된 뒤 — 보고 있는 표는 바로, 나머지 표는 다음에 열 때 새로 불러온다
    $effect(() => {
        if (refresh > 0) {
            untrack(() => {
                for (const p of PERIODS) if (p.id !== current) delete boards[p.id];
                void load(current, true);
            });
        }
    });
</script>

<section class="w-full space-y-3 rounded-lg border p-4" aria-label="{title} 순위">
    <div class="flex items-center justify-between gap-2">
        <h2 class="text-foreground text-sm font-semibold">{title}</h2>
        <div class="flex gap-1 rounded-lg border p-1" role="tablist" aria-label="랭킹 기간">
            {#each PERIODS as p (p.id)}
                <button
                    type="button"
                    role="tab"
                    aria-selected={current === p.id}
                    class="rounded-md px-3 py-1 text-xs {current === p.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'}"
                    onclick={() => select(p.id)}
                >
                    {p.label}
                </button>
            {/each}
        </div>
    </div>

    <p class="text-muted-foreground text-xs">
        {#if current === 'week'}
            이번 주 최고 점수 TOP 10 (월요일 0시에 새로 시작, 한국 시간)
        {:else}
            역대 최고 점수 TOP 10 (한 사람당 최고 기록 하나, 한국 시간)
        {/if}
    </p>

    {#if !view || view.state === 'loading'}
        <p class="text-muted-foreground text-sm">불러오는 중…</p>
    {:else if view.state === 'not_ready'}
        <p class="text-muted-foreground text-sm">
            랭킹 준비 중입니다. 게임은 그대로 즐길 수 있어요.
        </p>
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

    {#if !authStore.isAuthenticated}
        <p class="text-xs">
            <a href={loginHref} class="text-primary underline"
                >로그인하면 기록이 순위에 올라갑니다</a
            >
        </p>
    {:else if standing?.accepted}
        <p class="text-foreground text-xs">{myLine}</p>
    {/if}
</section>
