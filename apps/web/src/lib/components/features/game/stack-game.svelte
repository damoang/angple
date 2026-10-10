<script lang="ts">
    // 앙쌓기 — 떨어지는 블록을 쌓아 줄을 지우는 퍼즐.
    // 로직은 $lib/games/stack/engine.ts(순수·결정적), 루프·입력·캔버스는 $lib/games/shell.
    // 게임 상태는 평범한 객체로 두고, 화면 숫자(HUD)만 바뀔 때 $state 에 옮긴다.
    // 로그인 상태면 서버(stack-ws)에서 시드를 받아 시작하고 끝나면 기록을 낸다(점수판).
    // 비로그인·실패·3초 안에 답이 없으면 지금처럼 로컬 무작위 시드로 진행한다(「기록 미등록」).
    import { untrack } from 'svelte';
    import {
        COLS,
        ROWS,
        IN_LEFT,
        IN_RIGHT,
        IN_CW,
        IN_CCW,
        IN_SOFT,
        IN_HARD,
        createGame,
        step,
        type Game
    } from '$lib/games/stack/engine.js';
    import { createLoop, onPageHidden } from '$lib/games/shell/loop.js';
    import { bindKeys, createHeldInput } from '$lib/games/shell/input.js';
    import { fitCanvas, observeSize, prefersReducedMotion } from '$lib/games/shell/canvas.js';
    import { getGame } from '$lib/games/registry.js';
    import { drawBoard, drawNext } from '$lib/games/stack/render.js';
    import {
        buildSoloClaim,
        createSoloTracker,
        finishSoloRun,
        startSoloRun,
        trackStep,
        SOLO_START_GAP_MS,
        type SoloFinishResult
    } from '$lib/games/stack/solo-record.js';
    import { getStackToken } from '$lib/games/stack/auth-token.js';
    import { authStore } from '$lib/stores/auth.svelte.js';

    /** active=false 면 (다른 탭이 보이는 중) 일시정지하고 키 입력을 받지 않는다 */
    let { active = true }: { active?: boolean } = $props();

    const NAME = getGame('stack').name;
    const BEST_KEY = 'angple_stack_best';

    /** KeyboardEvent.code → 입력 비트 */
    const KEYMAP: Record<string, number> = {
        ArrowLeft: IN_LEFT,
        ArrowRight: IN_RIGHT,
        ArrowDown: IN_SOFT,
        ArrowUp: IN_CW,
        KeyX: IN_CW,
        KeyZ: IN_CCW,
        Space: IN_HARD
    };

    const PADS = [
        { bit: IN_LEFT, text: '←', label: '왼쪽' },
        { bit: IN_RIGHT, text: '→', label: '오른쪽' },
        { bit: IN_CW, text: '회전', label: '회전' },
        { bit: IN_SOFT, text: '↓', label: '소프트 드롭' },
        { bit: IN_HARD, text: '⤓', label: '하드 드롭' }
    ];

    type Status = 'idle' | 'starting' | 'playing' | 'paused' | 'over';
    /** 점수판 기록 상태: local=로컬 모드(기록 미등록), server=서버 판 진행 중 */
    type RecordState = 'none' | 'local' | 'server' | 'saving' | 'saved' | 'failed';

    let boardEl: HTMLCanvasElement;
    let nextEl: HTMLCanvasElement;
    let rootEl: HTMLDivElement;
    let status = $state<Status>('idle');
    let score = $state(0);
    let level = $state(1);
    let lines = $state(0);
    let best = $state(0);
    let announce = $state('');
    let pulse = $state(false);
    let record = $state<RecordState>('none');
    let standing = $state<SoloFinishResult | null>(null);
    /** 기록 관련 짧은 안내 (서버 판을 못 받았을 때 등) */
    let notice = $state('');

    // 반응형이 아닌 게임 상태
    let game: Game = createGame(1);
    let dirty = true;
    let reduceMotion = false;
    let pulseTimer: ReturnType<typeof setTimeout> | undefined;
    /** 서버가 발급한 이번 판 id (로컬 모드면 null) */
    let runId: string | null = null;
    let tracker = createSoloTracker();
    /** 시작할 때마다 오른다 — 늦게 온 응답이 새 판을 덮지 않게 */
    let startGen = 0;
    let destroyed = false;
    /** 마지막으로 서버에 판 시작을 요청한 시각 — 서버의 시작 간격 제한을 피해 기다린다 */
    let lastServerStart = 0;

    const input = createHeldInput({ repeat: IN_LEFT | IN_RIGHT, hold: IN_SOFT });
    const loop = createLoop(tick, render);

    function newSeed(): number {
        try {
            return crypto.getRandomValues(new Uint32Array(1))[0];
        } catch {
            return (Math.random() * 4294967296) >>> 0;
        }
    }

    function loadBest(): number {
        try {
            return Number(localStorage.getItem(BEST_KEY)) || 0;
        } catch {
            return 0;
        }
    }

    function saveBest(value: number) {
        try {
            localStorage.setItem(BEST_KEY, String(value));
        } catch {
            // 저장 불가(사생활 보호 모드 등) — 이번 방문 동안만 기억
        }
    }

    function tick() {
        const r = step(game, input.sample());
        trackStep(tracker, r);
        if (r.dirty) dirty = true;
        if (game.score !== score) score = game.score;
        if (r.cleared > 0) {
            lines = game.lines;
            const levelUp = game.level !== level;
            level = game.level;
            announce = `${r.cleared}줄 지움. 점수 ${game.score}${levelUp ? `. 레벨 ${game.level}` : ''}`;
            flash();
        }
        if (game.over) finish();
    }

    /** 줄을 지웠을 때 판 테두리를 잠깐 강조 — 움직임 줄이기 설정이면 하지 않는다 */
    function flash() {
        if (reduceMotion) return;
        pulse = true;
        clearTimeout(pulseTimer);
        pulseTimer = setTimeout(() => (pulse = false), 200);
    }

    async function start() {
        if (status === 'starting') return;
        loop.stop();
        input.clear();
        const gen = ++startGen;
        runId = null;
        standing = null;
        notice = '';
        let seed: number | null = null;
        if (authStore.isAuthenticated) {
            status = 'starting';
            announce = '준비 중';
            // 서버는 회원당 5초에 한 번만 판을 연다 — 너무 빨리 다시 시작하면 남은 시간만큼 기다린다
            const wait = lastServerStart + SOLO_START_GAP_MS + 300 - Date.now();
            if (wait > 0) {
                notice = `기록 등록을 위해 ${Math.ceil(wait / 1000)}초 뒤 시작합니다`;
                await new Promise((resolve) => setTimeout(resolve, wait));
                if (gen !== startGen || destroyed) return;
            }
            lastServerStart = Date.now();
            const run = await startSoloRun(getStackToken);
            if (gen !== startGen || destroyed) return;
            if (run) {
                runId = run.runId;
                seed = run.seed;
                notice = '';
            } else {
                notice = '기록 서버에 연결하지 못해 이번 판은 점수판에 기록되지 않습니다';
            }
        }
        record = runId ? 'server' : 'local';
        tracker = createSoloTracker();
        game = createGame(seed ?? newSeed());
        score = 0;
        level = 1;
        lines = 0;
        input.clear();
        status = 'playing';
        announce = '게임 시작';
        dirty = true;
        render();
        loop.start();
        // 준비하는 사이 다른 탭으로 갔으면 바로 멈춰 둔다
        if (document.hidden || !active) pause();
    }

    function pause() {
        if (status !== 'playing') return;
        loop.stop();
        input.clear();
        status = 'paused';
        announce = '일시정지';
    }

    function resume() {
        if (status !== 'paused') return;
        input.clear();
        status = 'playing';
        announce = '계속';
        loop.start();
    }

    function finish() {
        loop.stop();
        input.clear();
        status = 'over';
        if (game.score > best) {
            best = game.score;
            saveBest(best);
        }
        announce = `게임 끝. 점수 ${game.score}, 레벨 ${game.level}, ${game.lines}줄`;
        dirty = true;
        render();
        void submitRecord();
    }

    /** 서버 판이면 기록을 낸다 — 실패해도 게임 화면은 그대로 */
    async function submitRecord() {
        const id = runId;
        runId = null;
        if (!id) return;
        const gen = startGen;
        const claim = buildSoloClaim(game, tracker);
        record = 'saving';
        const res = await finishSoloRun(id, claim, getStackToken);
        if (gen !== startGen || destroyed) return;
        standing = res;
        record = res ? 'saved' : 'failed';
    }

    /* ── 그리기 ($lib/games/stack/render.ts) ── */
    function render() {
        if (!dirty || !boardEl || !nextEl) return;
        dirty = false;
        const ctx = fitCanvas(boardEl);
        if (ctx) {
            const w = boardEl.clientWidth;
            // 격자 — 캔버스의 CSS color(text-border)를 따라가므로 테마가 바뀌어도 맞는다
            drawBoard(ctx, game.board, w / COLS, {
                width: w,
                height: boardEl.clientHeight,
                grid: getComputedStyle(boardEl).color,
                piece: status === 'idle' || game.over ? null : game.piece
            });
        }
        const nctx = fitCanvas(nextEl);
        if (nctx) {
            drawNext(
                nctx,
                nextEl.clientWidth,
                nextEl.clientHeight,
                status === 'idle' ? null : game.next
            );
        }
    }

    /* ── 입력 ── */
    function onCommandKey(e: KeyboardEvent) {
        if (e.repeat) return;
        if (e.code === 'KeyP' || e.code === 'Escape') {
            if (status === 'playing') pause();
            else if (status === 'paused') resume();
            else return;
            e.preventDefault();
            return;
        }
        // Enter/Space 는 포커스가 페이지 본문이나 게임 영역 안에 있을 때만 받는다
        // (링크·다른 컨트롤의 Enter/Space, 페이지 스크롤을 가로채지 않게).
        // 버튼에 포커스가 있으면 버튼 자체 클릭에 맡긴다 (두 번 실행 방지)
        const t = e.target;
        const inGame = t instanceof Node && !!rootEl && rootEl.contains(t);
        if (t !== document.body && t !== document.documentElement && !inGame) return;
        if (t instanceof HTMLButtonElement) return;
        if (e.code === 'Enter' || e.code === 'Space') {
            if (status === 'paused') resume();
            else if (status === 'idle' || status === 'over') void start();
            else return;
            e.preventDefault();
        }
    }

    function padDown(e: PointerEvent, bit: number) {
        e.preventDefault();
        if (status !== 'playing') return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        input.press(bit);
    }

    /** 키보드·보조기기로 버튼을 누른 경우(포인터 없이 click 만 옴) — 한 번 입력 */
    function padClick(e: MouseEvent, bit: number) {
        if (e.detail !== 0 || status !== 'playing') return;
        input.press(bit);
        input.release(bit);
    }

    $effect(() =>
        untrack(() => {
            reduceMotion = prefersReducedMotion();
            best = loadBest();
            const offKeys = bindKeys(
                KEYMAP,
                input,
                () => active && status === 'playing',
                (e) => {
                    // 다른 탭이 보이는 동안에는 시작·일시정지 키도 받지 않는다
                    if (active) onCommandKey(e);
                }
            );
            const offHidden = onPageHidden(pause);
            const offSize = observeSize(boardEl, () => {
                dirty = true;
                render();
            });
            dirty = true;
            render();
            return () => {
                loop.stop();
                offKeys();
                offHidden();
                offSize();
                clearTimeout(pulseTimer);
                destroyed = true;
            };
        })
    );

    // 다른 탭으로 옮기면 일시정지한다 (판은 그대로 남는다)
    $effect(() => {
        if (!active) untrack(pause);
    });
</script>

<div bind:this={rootEl} class="stack-game flex select-none flex-col items-center gap-3">
    <div class="flex items-start justify-center gap-3">
        <div class="no-pan relative">
            <canvas
                bind:this={boardEl}
                class="bg-muted/40 text-border box-content block rounded-lg border shadow-sm motion-safe:transition-shadow {pulse
                    ? 'ring-primary/50 ring-4'
                    : ''}"
                style="width: var(--board-w); height: calc(var(--board-w) * {ROWS / COLS});"
                role="img"
                aria-label="{NAME} 게임판 ({COLS}칸 × {ROWS}줄)"
            ></canvas>

            {#if status !== 'playing'}
                <div
                    class="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg p-4 text-center"
                >
                    {#if status === 'idle'}
                        <p class="text-foreground text-xl font-bold">{NAME}</p>
                        <p class="text-muted-foreground text-xs">줄을 채우면 사라져요</p>
                        <button
                            type="button"
                            onclick={() => void start()}
                            class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                            >시작</button
                        >
                    {:else if status === 'starting'}
                        <p class="text-muted-foreground text-sm">준비 중…</p>
                        {#if notice}
                            <p class="text-muted-foreground text-xs">{notice}</p>
                        {/if}
                    {:else if status === 'paused'}
                        <p class="text-foreground text-lg font-bold">일시정지</p>
                        <button
                            type="button"
                            onclick={resume}
                            class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                            >계속</button
                        >
                    {:else}
                        <p class="text-foreground text-lg font-bold">게임 끝</p>
                        <p class="text-muted-foreground text-sm">점수 {score}</p>
                        {#if record === 'saving'}
                            <p class="text-muted-foreground text-xs">기록 저장 중…</p>
                        {:else if record === 'saved' && standing?.accepted}
                            <p class="text-foreground text-xs">
                                최고 기록 {standing.best.toLocaleString()}
                                {#if standing.rankWeek}
                                    · 이번 주 {standing.rankWeek}위
                                {/if}
                            </p>
                        {:else if record !== 'none'}
                            <p class="text-muted-foreground text-xs">기록 미등록</p>
                        {/if}
                        <button
                            type="button"
                            onclick={() => void start()}
                            class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                            >다시 하기</button
                        >
                    {/if}
                </div>
            {/if}
        </div>

        <div class="flex w-24 flex-col gap-3 text-sm">
            <div>
                <p class="text-muted-foreground text-xs">다음</p>
                <canvas
                    bind:this={nextEl}
                    class="bg-muted/40 mt-1 block h-16 w-16 rounded-md border"
                    role="img"
                    aria-label="다음 조각"
                ></canvas>
            </div>
            <dl class="grid gap-1">
                <div>
                    <dt class="text-muted-foreground text-xs">점수</dt>
                    <dd class="text-foreground font-bold tabular-nums">{score}</dd>
                </div>
                <div>
                    <dt class="text-muted-foreground text-xs">레벨</dt>
                    <dd class="text-foreground font-bold tabular-nums">{level}</dd>
                </div>
                <div>
                    <dt class="text-muted-foreground text-xs">줄</dt>
                    <dd class="text-foreground font-bold tabular-nums">{lines}</dd>
                </div>
                <div>
                    <dt class="text-muted-foreground text-xs">최고</dt>
                    <dd class="text-foreground tabular-nums">{best}</dd>
                </div>
            </dl>
            {#if record === 'local' && (status === 'playing' || status === 'paused')}
                <p
                    class="text-muted-foreground text-[11px] leading-tight"
                    title="로그인하지 않았거나 기록 서버에 연결하지 못해 점수판에 오르지 않습니다"
                >
                    기록 미등록
                </p>
                {#if notice}
                    <p class="text-muted-foreground text-[11px] leading-tight">{notice}</p>
                {/if}
            {/if}
            {#if status === 'playing' || status === 'paused'}
                <button
                    type="button"
                    onclick={() => (status === 'playing' ? pause() : resume())}
                    class="bg-muted text-foreground rounded-md px-2 py-1.5 text-xs font-medium"
                    >{status === 'playing' ? '일시정지' : '계속'}</button
                >
                <button
                    type="button"
                    onclick={() => void start()}
                    class="bg-muted text-foreground rounded-md px-2 py-1.5 text-xs font-medium"
                    >다시 시작</button
                >
            {/if}
        </div>
    </div>

    <div
        class="no-pan grid w-full max-w-[22rem] grid-cols-5 gap-2"
        role="group"
        aria-label="조작 버튼"
    >
        {#each PADS as pad (pad.bit)}
            <button
                type="button"
                aria-label={pad.label}
                class="bg-muted text-foreground h-14 rounded-lg text-lg font-semibold active:opacity-70"
                onpointerdown={(e) => padDown(e, pad.bit)}
                onpointerup={() => input.release(pad.bit)}
                onpointercancel={() => input.release(pad.bit)}
                onclick={(e) => padClick(e, pad.bit)}
                oncontextmenu={(e) => e.preventDefault()}
            >
                {pad.text}
            </button>
        {/each}
    </div>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
    <p class="text-muted-foreground text-center text-xs">
        ← → 이동 · ↑/X 회전 · Z 반대 회전 · ↓ 천천히 · 스페이스 바로 내리기 · P/Esc 일시정지
    </p>
</div>

<style>
    .stack-game {
        --board-w: min(58vw, 15rem);
    }
    /* 게임판·조작 버튼 위에서는 화면이 스크롤·확대되지 않는다 */
    .no-pan {
        touch-action: none;
        overscroll-behavior: contain;
        -webkit-touch-callout: none;
    }
</style>
