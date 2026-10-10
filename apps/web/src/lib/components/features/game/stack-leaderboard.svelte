<script lang="ts">
    /**
     * 앙쌓기 점수판 — 공개 GET /stack-ws/leaderboard?board=… (인증 불요, 닉네임만 공개).
     * 각 표는 처음 열 때 한 번만 불러온다(서버·CDN 이 60초 캐시한다).
     */
    import { untrack } from 'svelte';
    import { STACK_API_BASE } from '$lib/games/stack/solo-record.js';

    type BoardId = 'solo_week' | 'solo_all' | 'vs_attack' | 'vs_sprint40';

    interface SoloRow {
        rank: number;
        nickname: string;
        score: number;
        lines: number;
        level: number;
    }
    interface VersusRow {
        rank: number;
        nickname: string;
        rating: number;
        wins: number;
        losses: number;
        draws: number;
    }
    type Loaded =
        | { state: 'loading' }
        | { state: 'error' }
        | { state: 'ok'; rows: Array<SoloRow | VersusRow>; weekStart?: string };

    const BOARDS: Array<{ id: BoardId; label: string; versus: boolean }> = [
        { id: 'solo_week', label: '이번 주', versus: false },
        { id: 'solo_all', label: '역대', versus: false },
        { id: 'vs_attack', label: '공격 모드', versus: true },
        { id: 'vs_sprint40', label: '40줄', versus: true }
    ];

    let current = $state<BoardId>('solo_week');
    let boards = $state<Partial<Record<BoardId, Loaded>>>({});

    const meta = $derived(BOARDS.find((b) => b.id === current) ?? BOARDS[0]);
    const view = $derived(boards[current]);

    async function load(id: BoardId) {
        if (boards[id]) return;
        boards[id] = { state: 'loading' };
        try {
            const r = await fetch(`${STACK_API_BASE}/leaderboard?board=${id}`);
            if (!r.ok) throw new Error(String(r.status));
            const body = await r.json();
            const rows = Array.isArray(body?.rows) ? body.rows : [];
            boards[id] = {
                state: 'ok',
                rows,
                weekStart: typeof body?.weekStart === 'string' ? body.weekStart : undefined
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

    function medal(rank: number): string {
        return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
    }

    // 처음 열 때 기본 표 하나만 불러온다 — 반응형 값을 읽지 않는 1회 설치
    $effect(() =>
        untrack(() => {
            void load('solo_week');
        })
    );
</script>

<div class="space-y-3">
    <div class="grid grid-cols-4 gap-1 rounded-lg border p-1" role="tablist" aria-label="점수판">
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
            혼자하기 이번 주 최고 점수 (월요일 0시에 새로 시작)
        {:else if current === 'solo_all'}
            혼자하기 역대 최고 점수 (한 사람당 최고 기록 하나)
        {:else}
            {meta.label} 대전 레이팅
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
        <table class="w-full text-sm">
            <thead>
                <tr class="text-muted-foreground border-b text-left text-xs">
                    <th class="w-10 py-1.5 pr-2">순위</th>
                    <th class="py-1.5 pr-2">앙님</th>
                    {#if meta.versus}
                        <th class="py-1.5 pr-2 text-right">전적</th>
                        <th class="py-1.5 text-right">레이팅</th>
                    {:else}
                        <th class="py-1.5 pr-2 text-right">줄</th>
                        <th class="py-1.5 text-right">점수</th>
                    {/if}
                </tr>
            </thead>
            <tbody>
                {#each view.rows as row, i (i)}
                    <tr class="border-b border-dashed last:border-0">
                        <td class="py-1.5 pr-2">{medal(row.rank || i + 1)}</td>
                        <td class="max-w-[9rem] truncate py-1.5 pr-2">{row.nickname}</td>
                        {#if 'rating' in row}
                            <td class="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">
                                {row.wins}승 {row.losses}패{row.draws ? ` ${row.draws}무` : ''}
                            </td>
                            <td class="py-1.5 text-right font-medium tabular-nums">{row.rating}</td>
                        {:else}
                            <td class="py-1.5 pr-2 text-right tabular-nums">{row.lines}</td>
                            <td class="py-1.5 text-right font-medium tabular-nums"
                                >{row.score.toLocaleString()}</td
                            >
                        {/if}
                    </tr>
                {/each}
            </tbody>
        </table>
    {/if}
</div>
