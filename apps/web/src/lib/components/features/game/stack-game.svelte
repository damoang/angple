<script lang="ts">
    // 앙쌓기 — 떨어지는 블록을 쌓아 줄을 지우는 퍼즐.
    // 로직은 $lib/games/stack/engine.ts(순수·결정적), 루프·입력·캔버스는 $lib/games/shell.
    // 게임 상태는 평범한 객체로 두고, 화면 숫자(HUD)만 바뀔 때 $state 에 옮긴다.
    import { untrack } from 'svelte';
    import {
        COLS,
        ROWS,
        SHAPES,
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

    const NAME = getGame('stack').name;
    const BEST_KEY = 'angple_stack_best';

    /** 조각별 색 — 자체 팔레트(밝은/어두운 테마 모두에서 보이는 중간 채도) */
    const PALETTE = ['#e8836b', '#3fa7a0', '#d9a441', '#c76aa6', '#5b8fd9', '#8fb65a', '#9a7fd1'];

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

    type Status = 'idle' | 'playing' | 'paused' | 'over';

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

    // 반응형이 아닌 게임 상태
    let game: Game = createGame(1);
    let dirty = true;
    let reduceMotion = false;
    let pulseTimer: ReturnType<typeof setTimeout> | undefined;

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

    function start() {
        game = createGame(newSeed());
        score = 0;
        level = 1;
        lines = 0;
        input.clear();
        status = 'playing';
        announce = '게임 시작';
        dirty = true;
        render();
        loop.start();
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
    }

    /* ── 그리기 ── */
    function render() {
        if (!dirty || !boardEl || !nextEl) return;
        dirty = false;
        drawBoard();
        drawNext();
    }

    /** roundRect 가 없는 브라우저(iOS 15 등)에서는 각진 사각형으로 그린다 */
    function roundRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
    ) {
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    /** 칸 하나: 둥근 타일 + 왼쪽 위 작은 광택 + 조각별 무늬(색만으로 구분하지 않게) */
    function tile(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: number) {
        const pad = Math.max(1, s * 0.06);
        const size = s - pad * 2;
        ctx.fillStyle = PALETTE[kind];
        ctx.beginPath();
        roundRect(ctx, x + pad, y + pad, size, size, size * 0.24);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        roundRect(ctx, x + pad * 2.5, y + pad * 2.5, size * 0.32, size * 0.14, size * 0.07);
        ctx.fill();

        const cx = x + s / 2;
        const cy = y + s / 2 + s * 0.04;
        const m = s * 0.16;
        ctx.strokeStyle = ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = Math.max(1.5, s * 0.08);
        ctx.lineCap = 'round';
        ctx.beginPath();
        switch (kind) {
            case 0: // 가로 줄
                ctx.moveTo(cx - m, cy);
                ctx.lineTo(cx + m, cy);
                break;
            case 1: // 작은 네모
                ctx.rect(cx - m * 0.7, cy - m * 0.7, m * 1.4, m * 1.4);
                ctx.fill();
                return;
            case 2: // 점
                ctx.arc(cx, cy, m * 0.75, 0, Math.PI * 2);
                ctx.fill();
                return;
            case 3: // 빗금 /
                ctx.moveTo(cx - m, cy + m);
                ctx.lineTo(cx + m, cy - m);
                break;
            case 4: // 빗금 \
                ctx.moveTo(cx - m, cy - m);
                ctx.lineTo(cx + m, cy + m);
                break;
            case 5: // 고리
                ctx.arc(cx, cy, m, 0, Math.PI * 2);
                break;
            default: // 더하기
                ctx.moveTo(cx - m, cy);
                ctx.lineTo(cx + m, cy);
                ctx.moveTo(cx, cy - m);
                ctx.lineTo(cx, cy + m);
        }
        ctx.stroke();
    }

    function drawBoard() {
        const ctx = fitCanvas(boardEl);
        if (!ctx) return;
        const w = boardEl.clientWidth;
        const h = boardEl.clientHeight;
        const s = w / COLS;
        ctx.clearRect(0, 0, w, h);

        // 격자 — 캔버스의 CSS color(text-border)를 따라가므로 테마가 바뀌어도 맞는다
        ctx.strokeStyle = getComputedStyle(boardEl).color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 1; c < COLS; c++) {
            ctx.moveTo(Math.round(c * s) + 0.5, 0);
            ctx.lineTo(Math.round(c * s) + 0.5, h);
        }
        for (let r = 1; r < ROWS; r++) {
            ctx.moveTo(0, Math.round(r * s) + 0.5);
            ctx.lineTo(w, Math.round(r * s) + 0.5);
        }
        ctx.stroke();

        for (let i = 0; i < game.board.length; i++) {
            const v = game.board[i];
            if (v) tile(ctx, (i % COLS) * s, Math.floor(i / COLS) * s, s, v - 1);
        }
        if (status === 'idle' || game.over) return;
        const p = game.piece;
        for (const [cx, cy] of SHAPES[p.kind][p.rot]) {
            if (p.y + cy >= 0) tile(ctx, (p.x + cx) * s, (p.y + cy) * s, s, p.kind);
        }
    }

    function drawNext() {
        const ctx = fitCanvas(nextEl);
        if (!ctx) return;
        const w = nextEl.clientWidth;
        ctx.clearRect(0, 0, w, nextEl.clientHeight);
        if (status === 'idle') return;
        const cells = SHAPES[game.next][0];
        const xs = cells.map((c) => c[0]);
        const ys = cells.map((c) => c[1]);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const cw = Math.max(...xs) - minX + 1;
        const ch = Math.max(...ys) - minY + 1;
        const s = w / 4.5;
        const ox = (w - cw * s) / 2;
        const oy = (w - ch * s) / 2;
        for (const [x, y] of cells)
            tile(ctx, ox + (x - minX) * s, oy + (y - minY) * s, s, game.next);
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
            else if (status === 'idle' || status === 'over') start();
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
            const offKeys = bindKeys(KEYMAP, input, () => status === 'playing', onCommandKey);
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
            };
        })
    );
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
                            onclick={start}
                            class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                            >시작</button
                        >
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
                        <button
                            type="button"
                            onclick={start}
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
            {#if status === 'playing' || status === 'paused'}
                <button
                    type="button"
                    onclick={() => (status === 'playing' ? pause() : resume())}
                    class="bg-muted text-foreground rounded-md px-2 py-1.5 text-xs font-medium"
                    >{status === 'playing' ? '일시정지' : '계속'}</button
                >
                <button
                    type="button"
                    onclick={start}
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
