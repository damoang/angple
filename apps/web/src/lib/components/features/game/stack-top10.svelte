<script lang="ts">
    /**
     * 혼자하기 아래 「최고 점수 TOP 10」(역대, solo_all).
     * 처음 보일 때 한 번, 기록을 낸 뒤(refresh 가 오를 때) 한 번 불러온다. 주기적으로 다시 부르지 않는다.
     */
    import { untrack } from 'svelte';
    import StackLeaderboardTable from './stack-leaderboard-table.svelte';
    import {
        fetchLeaderboard,
        type SoloRow,
        type VersusRow
    } from '$lib/games/stack/leaderboard.js';

    let {
        visible = true,
        refresh = 0
    }: {
        /** 혼자하기 탭이 보이는가 — 처음 true 가 될 때 불러온다 */
        visible?: boolean;
        /** 기록을 낸 뒤 1씩 올린다 — 오를 때마다 한 번 다시 불러온다 */
        refresh?: number;
    } = $props();

    type View =
        | { state: 'loading' }
        | { state: 'error' }
        | { state: 'ok'; rows: Array<SoloRow | VersusRow>; at: number };

    let view = $state<View | null>(null);
    let started = false;
    /** 늦게 온 응답이 새 응답을 덮지 않게 */
    let gen = 0;

    async function load(fresh: boolean) {
        started = true;
        const my = ++gen;
        if (!view || view.state !== 'ok') view = { state: 'loading' };
        try {
            const data = await fetchLeaderboard('solo_all', { fresh });
            if (my === gen) view = { state: 'ok', rows: data.rows, at: Date.now() };
        } catch {
            // 이미 표가 있으면 그대로 둔다
            if (my === gen && (!view || view.state !== 'ok')) view = { state: 'error' };
        }
    }

    // 처음 보일 때 한 번
    $effect(() => {
        if (visible && !started) untrack(() => void load(false));
    });

    // 기록을 낸 뒤 한 번 (처음 값 0 은 건너뛴다)
    $effect(() => {
        if (refresh > 0) untrack(() => void load(true));
    });
</script>

<section class="w-full max-w-[22rem] space-y-1.5" aria-label="최고 점수 TOP 10">
    <h2 class="text-foreground text-sm font-semibold">최고 점수 TOP 10</h2>
    {#if !view || view.state === 'loading'}
        <p class="text-muted-foreground text-xs">불러오는 중…</p>
    {:else if view.state === 'error'}
        <div class="flex items-center gap-2">
            <p class="text-muted-foreground text-xs">점수판을 불러오지 못했습니다.</p>
            <button type="button" class="text-primary text-xs underline" onclick={() => load(false)}
                >다시 시도</button
            >
        </div>
    {:else if view.rows.length === 0}
        <p class="text-muted-foreground text-xs">
            아직 기록이 없습니다. 로그인하고 끝까지 해 보세요!
        </p>
    {:else}
        <StackLeaderboardTable rows={view.rows} now={view.at} />
        <p class="text-muted-foreground text-[11px]">
            기록 시각은 한국 시간 · 이번 주 순위는 순위 탭에서
        </p>
    {/if}
</section>
