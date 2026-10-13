<script lang="ts">
    /**
     * 앙쌓기 점수판 — 공개 GET /stack-ws/leaderboard?board=… (인증 불요, 닉네임만 공개).
     * 각 표는 처음 열 때 한 번만 불러온다(서버·CDN 이 60초 캐시한다). 표마다 10줄.
     */
    import { untrack } from 'svelte';
    import StackLeaderboardTable from './stack-leaderboard-table.svelte';
    import {
        fetchLeaderboard,
        type BoardId,
        type ScoreRow,
        type VersusRow
    } from '$lib/games/stack/leaderboard.js';

    type Loaded =
        | { state: 'loading' }
        | { state: 'error' }
        | { state: 'ok'; rows: Array<ScoreRow | VersusRow>; weekStart?: string; at: number };

    const BOARDS: Array<{ id: BoardId; label: string; versus: boolean }> = [
        { id: 'solo_week', label: '이번 주', versus: false },
        { id: 'solo_all', label: '역대', versus: false },
        { id: 'vs_attack', label: '공격 모드', versus: true },
        { id: 'vs_sprint40', label: '40줄', versus: true },
        { id: 'vs_survival', label: '생존전', versus: true },
        { id: 'vs_score120', label: '점수전', versus: true }
    ];

    let current = $state<BoardId>('solo_week');
    let boards = $state<Partial<Record<BoardId, Loaded>>>({});

    const meta = $derived(BOARDS.find((b) => b.id === current) ?? BOARDS[0]);
    const view = $derived(boards[current]);

    async function load(id: BoardId) {
        if (boards[id]) return;
        boards[id] = { state: 'loading' };
        try {
            const data = await fetchLeaderboard(id);
            boards[id] = {
                state: 'ok',
                rows: data.rows,
                weekStart: data.weekStart,
                at: Date.now()
            };
        } catch {
            boards[id] = { state: 'error' };
        }
    }

    function select(id: BoardId) {
        current = id;
        void load(id);
    }

    function retry() {
        delete boards[current];
        void load(current);
    }

    // 처음 열 때 기본 표 하나만 불러온다 — 반응형 값을 읽지 않는 1회 설치
    $effect(() =>
        untrack(() => {
            void load('solo_week');
        })
    );
</script>

<div class="space-y-3">
    <div
        class="grid grid-cols-3 gap-1 rounded-lg border p-1 sm:grid-cols-6"
        role="tablist"
        aria-label="점수판"
    >
        {#each BOARDS as b (b.id)}
            <button
                type="button"
                role="tab"
                aria-selected={current === b.id}
                class="rounded-md px-1 py-1.5 text-xs {current === b.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'}"
                onclick={() => select(b.id)}
            >
                {b.label}
            </button>
        {/each}
    </div>

    <p class="text-muted-foreground text-xs">
        {#if current === 'solo_week'}
            혼자하기 이번 주 최고 점수 TOP 10 (월요일 0시에 새로 시작, 한국 시간)
        {:else if current === 'solo_all'}
            혼자하기 역대 최고 점수 TOP 10 (한 사람당 최고 기록 하나, 한국 시간)
        {:else}
            {meta.label} 대전 레이팅 TOP 10
        {/if}
    </p>

    {#if !view || view.state === 'loading'}
        <p class="text-muted-foreground text-sm">불러오는 중…</p>
    {:else if view.state === 'error'}
        <div class="flex items-center gap-2">
            <p class="text-muted-foreground text-sm">점수판을 불러오지 못했습니다.</p>
            <button type="button" class="text-primary text-sm underline" onclick={retry}
                >다시 시도</button
            >
        </div>
    {:else if view.rows.length === 0}
        <p class="text-muted-foreground text-sm">
            {meta.versus
                ? '아직 대전 기록이 없습니다. 첫 주인공이 되어 보세요!'
                : '아직 기록이 없습니다. 로그인하고 혼자하기를 끝까지 해 보세요!'}
        </p>
    {:else}
        <StackLeaderboardTable rows={view.rows} versus={meta.versus} now={view.at} />
    {/if}
</div>
