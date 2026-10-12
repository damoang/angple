<script lang="ts">
    /**
     * 장기 AI 연습판 (1인 vs AI / 2인 한 화면).
     *
     * 규칙·배치 = $lib/games/janggi/rules, AI 탐색 = $lib/games/janggi/ai (Web Worker 에서 실행),
     * 그리기 = janggi-board.svelte (온라인 대전과 같은 보드).
     */
    import { onDestroy } from 'svelte';
    import JanggiBoard from './janggi-board.svelte';
    import JanggiSetupPicker from './janggi-setup-picker.svelte';
    import {
        DEFAULT_SETUP,
        KIND,
        LEGACY_SETUP,
        SETUPS,
        TEAM,
        applyMove,
        getBoard,
        getMoves,
        initPieces,
        isCheck,
        isSetup,
        type JanggiPiece,
        type Point,
        type Setup
    } from '$lib/games/janggi/rules';
    import {
        DEFAULT_DIFFICULTY,
        DIFFICULTIES,
        DIFFICULTY_LABEL,
        isDifficulty,
        type Difficulty
    } from '$lib/games/janggi/ai';
    import { createJanggiAi, type JanggiAi } from '$lib/games/janggi/ai-client';

    const DIFFICULTY_KEY = 'angple_janggi_difficulty';
    const SETUP_KEY = 'angple_janggi_setup';

    const DIFFICULTY_HINT: Record<Difficulty, string> = {
        easy: '실수도 하는 상대',
        normal: '기본 상대',
        hard: '깊게 읽는 상대 (최대 3초 생각)'
    };

    /* ── 상태 ── */
    let phase = $state<'setup' | 'playing'>('setup');
    let isSingle = $state(true);
    let difficulty = $state<Difficulty>(DEFAULT_DIFFICULTY);
    let mySetup = $state<Setup>(DEFAULT_SETUP);
    let hanSetup = $state<Setup>(LEGACY_SETUP.han);

    let pieces = $state<JanggiPiece[]>(initPieces());
    let selectedIndex = $state<number | null>(null);
    let targets = $state<Point[]>([]);
    let turn = $state<number>(TEAM.CHO);
    let gameOver = $state(false);
    let winner = $state<number | null>(null);
    let thinking = $state(false);
    let lastMove = $state<{ from: Point; to: Point } | null>(null);
    let checkTeam = $state<number | null>(null);
    let message = $state('');

    // 판이 새로 시작될 때마다 올려서 늦게 도착한 AI 응답을 버린다.
    let generation = 0;
    let ai: JanggiAi | null = null;

    const selected = $derived(
        selectedIndex !== null && pieces[selectedIndex]
            ? { x: pieces[selectedIndex].x, y: pieces[selectedIndex].y }
            : null
    );

    // 저장된 난이도·상차림 — 브라우저에서만, 실패해도 기본값으로 동작
    $effect(() => {
        try {
            const d = localStorage.getItem(DIFFICULTY_KEY);
            if (isDifficulty(d)) difficulty = d;
            const s = localStorage.getItem(SETUP_KEY);
            if (isSetup(s)) mySetup = s;
        } catch {
            // 저장소 차단 — 기본값 유지
        }
    });

    function chooseDifficulty(d: Difficulty) {
        difficulty = d;
        try {
            localStorage.setItem(DIFFICULTY_KEY, d);
        } catch {
            // 무시
        }
    }

    function chooseSetup(s: Setup) {
        mySetup = s;
        try {
            localStorage.setItem(SETUP_KEY, s);
        } catch {
            // 무시
        }
    }

    function other(team: number): number {
        return team === TEAM.CHO ? TEAM.HAN : TEAM.CHO;
    }

    function teamLabel(team: number): string {
        return team === TEAM.CHO ? '초(楚)' : '한(漢)';
    }

    /* ── 게임 시작/리셋 ── */
    function startGame() {
        generation++;
        if (isSingle) hanSetup = SETUPS[Math.floor(Math.random() * SETUPS.length)];
        pieces = initPieces(mySetup, hanSetup);
        selectedIndex = null;
        targets = [];
        turn = TEAM.CHO;
        gameOver = false;
        winner = null;
        thinking = false;
        lastMove = null;
        checkTeam = null;
        message = '';
        phase = 'playing';
    }

    function backToSetup() {
        generation++;
        thinking = false;
        selectedIndex = null;
        targets = [];
        phase = 'setup';
    }

    /* ── 수 두기 ── */
    function playMove(index: number, to: Point) {
        const mover = pieces[index];
        const from = { x: mover.x, y: mover.y };
        const captured = pieces.find(
            (p) => p.alive && p.x === to.x && p.y === to.y && p.team !== mover.team
        );
        pieces = applyMove(pieces, index, to);
        lastMove = { from, to };
        selectedIndex = null;
        targets = [];

        if (captured && captured.kind === KIND.GUNG) {
            gameOver = true;
            winner = mover.team;
            checkTeam = null;
            message = '';
            return;
        }

        const opp = other(mover.team);
        if (isCheck(pieces, opp)) {
            checkTeam = opp;
            message = '장군!';
        } else {
            checkTeam = null;
            message = '';
        }
        turn = opp;
        if (isSingle && turn === TEAM.HAN) void aiTurn();
    }

    async function aiTurn() {
        const gen = generation;
        thinking = true;
        if (!ai) ai = createJanggiAi();
        const res = await ai.think(pieces, TEAM.HAN, difficulty);
        if (gen !== generation) return; // 그사이 새 판
        thinking = false;
        if (!res) {
            gameOver = true;
            winner = TEAM.CHO;
            return;
        }
        const p = pieces[res.index];
        if (!p || !p.alive || p.team !== TEAM.HAN || p.x !== res.from.x || p.y !== res.from.y) {
            return;
        }
        playMove(res.index, res.to);
    }

    /* ── 클릭 ── */
    function handlePoint(x: number, y: number) {
        if (phase !== 'playing' || gameOver || thinking) return;
        if (isSingle && turn !== TEAM.CHO) return;

        if (selectedIndex !== null && targets.some((m) => m.x === x && m.y === y)) {
            playMove(selectedIndex, { x, y });
            return;
        }

        const idx = pieces.findIndex((p) => p.alive && p.x === x && p.y === y);
        if (idx >= 0 && pieces[idx].team === turn) {
            selectedIndex = idx;
            targets = getMoves(pieces[idx], getBoard(pieces));
        } else {
            selectedIndex = null;
            targets = [];
        }
    }

    onDestroy(() => {
        generation++;
        ai?.dispose();
        ai = null;
    });
</script>

<div class="flex flex-col items-center gap-4">
    {#if phase === 'setup'}
        <div class="w-full max-w-[560px] space-y-4 rounded-lg border p-4">
            <div class="flex flex-wrap items-center gap-3">
                <label class="flex items-center gap-2 text-sm">
                    <input type="radio" bind:group={isSingle} value={true} />
                    <span>1인 (vs AI)</span>
                </label>
                <label class="flex items-center gap-2 text-sm">
                    <input type="radio" bind:group={isSingle} value={false} />
                    <span>2인 대전</span>
                </label>
            </div>

            {#if isSingle}
                <div class="space-y-2">
                    <p class="text-foreground text-sm font-medium">난이도</p>
                    <div class="bg-muted inline-flex gap-1 rounded-lg p-1" role="group">
                        {#each DIFFICULTIES as d (d)}
                            <button
                                type="button"
                                class="rounded-md px-3 py-1.5 text-sm {difficulty === d
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground'}"
                                aria-pressed={difficulty === d}
                                onclick={() => chooseDifficulty(d)}
                            >
                                {DIFFICULTY_LABEL[d]}
                            </button>
                        {/each}
                    </div>
                    <p class="text-muted-foreground text-xs">{DIFFICULTY_HINT[difficulty]}</p>
                </div>
            {/if}

            <JanggiSetupPicker
                value={mySetup}
                team={TEAM.CHO}
                legend={isSingle ? '내 상차림 (초)' : '초(楚) 상차림'}
                onSelect={chooseSetup}
            />
            {#if isSingle}
                <p class="text-muted-foreground text-xs">
                    배치는 내 쪽에서 본 왼쪽부터입니다. AI(한)의 상차림은 무작위로 정해집니다.
                </p>
            {:else}
                <JanggiSetupPicker
                    value={hanSetup}
                    team={TEAM.HAN}
                    legend="한(漢) 상차림 — 한 쪽에서 본 왼쪽부터"
                    onSelect={(s) => (hanSetup = s)}
                />
            {/if}

            <button
                type="button"
                onclick={startGame}
                class="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 text-sm font-medium"
            >
                대국 시작
            </button>
        </div>
    {:else}
        <!-- 컨트롤 -->
        <div class="flex flex-wrap items-center justify-center gap-2 text-sm">
            {#if isSingle}
                <span class="bg-muted rounded-md px-2 py-1 text-xs">
                    AI {DIFFICULTY_LABEL[difficulty]} · 나 {mySetup} · AI {hanSetup}
                </span>
            {:else}
                <span class="bg-muted rounded-md px-2 py-1 text-xs">
                    2인 · 초 {mySetup} · 한 {hanSetup}
                </span>
            {/if}
            <button
                type="button"
                onclick={startGame}
                class="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
            >
                다시 시작
            </button>
            <button
                type="button"
                onclick={backToSetup}
                class="rounded-md border px-3 py-1.5 text-sm font-medium"
            >
                설정 바꾸기
            </button>
        </div>

        <!-- 상태 -->
        <div class="min-h-7 text-sm font-medium" aria-live="polite">
            {#if gameOver}
                <span class="text-destructive text-lg font-bold">
                    {#if isSingle}
                        {winner === TEAM.CHO ? '🎉 승리!' : '😢 패배...'}
                    {:else}
                        {winner ? `${teamLabel(winner)} 승리!` : ''}
                    {/if}
                </span>
            {:else if thinking}
                <span class="text-muted-foreground animate-pulse">AI 생각 중…</span>
            {:else if message}
                <span class="text-destructive font-bold">{message}</span>
            {:else}
                <span class="text-foreground">
                    {turn === TEAM.CHO ? '🟢 초(楚) 차례' : '🔴 한(漢) 차례'}
                </span>
            {/if}
        </div>

        <div class="w-full">
            <JanggiBoard
                {pieces}
                {selected}
                {targets}
                {lastMove}
                {checkTeam}
                interactive={!gameOver && !thinking && (!isSingle || turn === TEAM.CHO)}
                onPointClick={handlePoint}
                label="장기판 — {isSingle ? 'AI 연습' : '2인 대전'}"
            />
        </div>
    {/if}
</div>
