<script lang="ts">
    // 뱀 게임 - Snake Game
    // 규칙은 $lib/games/snake/engine.ts (결정적 — 서버가 같은 규칙으로 기록을 다시 돌려 본다).
    // 로그인 상태면 서버(stack-ws)에서 시드를 받아 시작하고 끝나면 입력 기록을 내 랭킹에 올린다.
    // 비로그인·실패·3초 안에 답이 없으면 로컬 무작위 시드로 그대로 진행한다(「기록 미등록」).
    import {
        DIR_DOWN,
        DIR_LEFT,
        DIR_RIGHT,
        DIR_UP,
        GRID,
        createGame,
        opposite,
        speedFor,
        stepRecorded,
        type SnakeGame,
        type SnakeInput
    } from '$lib/games/snake/engine.js';
    import {
        SNAKE_START_GAP_MS,
        finishSnakeRun,
        loadLocalBest,
        saveLocalBest,
        startSnakeRun,
        type SnakeFinishResult
    } from '$lib/games/snake/record.js';
    import { getStackToken } from '$lib/games/stack/auth-token.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import SnakeRanking from './snake-ranking.svelte';

    /* ── 상수 ── */
    const CELL = 20;
    const W = GRID * CELL;
    const H = GRID * CELL;

    type Pos = { x: number; y: number };
    type Status = 'idle' | 'starting' | 'playing' | 'over';
    /** 랭킹 기록 상태: local=로컬 모드(기록 미등록), server=서버 판 진행 중 */
    type RecordState = 'none' | 'local' | 'server' | 'saving' | 'saved' | 'failed';

    /* ── 상태 ── */
    let canvas: HTMLCanvasElement;
    let status = $state<Status>('idle');
    let score = $state(0);
    let highScore = $state(0);
    let record = $state<RecordState>('none');
    let standing = $state<SnakeFinishResult | null>(null);
    /** 기록 관련 짧은 안내 */
    let notice = $state('');
    /** 기록이 랭킹에 들어갈 때마다 1씩 — 랭킹 카드를 한 번 다시 불러온다 */
    let rankingRefresh = $state(0);

    // 반응형이 아닌 게임 상태
    let game: SnakeGame = createGame(1);
    let nextDir: number = DIR_RIGHT;
    let inputs: SnakeInput[] = [];
    let timer: ReturnType<typeof setInterval> | null = null;
    /** 서버가 발급한 이번 판 id (로컬 모드면 null) */
    let runId: string | null = null;
    /** 시작할 때마다 오른다 — 늦게 온 응답이 새 판을 덮지 않게 */
    let startGen = 0;
    let destroyed = false;
    /** 마지막으로 서버에 판 시작을 요청한 시각 — 서버의 시작 간격 제한을 피해 기다린다 */
    let lastServerStart = 0;

    function newSeed(): number {
        try {
            return crypto.getRandomValues(new Uint32Array(1))[0];
        } catch {
            return (Math.random() * 4294967296) >>> 0;
        }
    }

    function stopTimer() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    /** 서버 판을 받을 수 있으면 받는다 — 로그인 회원만. 실패하면 null(로컬 모드) */
    async function requestRun(gen: number): Promise<number | null> {
        if (!authStore.isAuthenticated) return null;
        status = 'starting';
        draw();
        // 서버는 회원당 5초에 한 번만 판을 연다 — 너무 빨리 다시 시작하면 남은 시간만큼 기다린다
        const wait = lastServerStart + SNAKE_START_GAP_MS + 300 - Date.now();
        if (wait > 0) {
            notice = `기록 등록을 위해 ${Math.ceil(wait / 1000)}초 뒤 시작합니다`;
            await new Promise((resolve) => setTimeout(resolve, wait));
            if (gen !== startGen || destroyed) return null;
        }
        lastServerStart = Date.now();
        const run = await startSnakeRun(getStackToken);
        if (gen !== startGen || destroyed) return null;
        if (!run) {
            notice = '기록 서버에 연결하지 못해 이번 판은 랭킹에 기록되지 않습니다';
            return null;
        }
        runId = run.runId;
        notice = '';
        return run.seed;
    }

    async function startGame() {
        if (status === 'starting') return;
        stopTimer();
        const gen = ++startGen;
        runId = null;
        standing = null;
        notice = '';
        const seed = await requestRun(gen);
        if (gen !== startGen || destroyed) return;
        record = runId ? 'server' : 'local';
        game = createGame(seed ?? newSeed());
        nextDir = DIR_RIGHT;
        inputs = [];
        score = 0;
        status = 'playing';
        draw();
        tick();
    }

    /** 지금 점수의 속도로 타이머를 다시 건다(먹을 때마다 빨라진다) */
    function tick() {
        stopTimer();
        timer = setInterval(() => {
            if (status !== 'playing') return;
            step();
        }, speedFor(game.score));
    }

    function step() {
        const ate = stepRecorded(game, inputs, nextDir);
        score = game.score;
        if (game.over) {
            endGame();
            return;
        }
        draw();
        // 속도 변경
        if (ate) tick();
    }

    function endGame() {
        stopTimer();
        status = 'over';
        if (game.score > highScore) {
            highScore = game.score;
            saveLocalBest(highScore);
        }
        draw();
        void submitRecord();
    }

    /** 서버 판이면 기록을 낸다 — 실패해도 게임 화면은 그대로 */
    async function submitRecord() {
        const id = runId;
        runId = null;
        if (!id) return;
        const gen = startGen;
        record = 'saving';
        const res = await finishSnakeRun(id, inputs, game.score, getStackToken);
        if (gen !== startGen || destroyed) return;
        standing = res;
        record = res ? 'saved' : 'failed';
        if (res?.accepted) {
            if (res.best > highScore) {
                highScore = res.best;
                saveLocalBest(highScore);
            }
            rankingRefresh++;
        }
    }

    /** 방향 입력 — 지금 가고 있는 방향의 반대만 막는다(기존 규칙). 적용은 다음 틱 */
    function press(d: number) {
        if (d !== opposite(game.dir)) nextDir = d;
    }

    const KEY_DIRS: Record<string, number> = {
        ArrowUp: DIR_UP,
        ArrowDown: DIR_DOWN,
        ArrowLeft: DIR_LEFT,
        ArrowRight: DIR_RIGHT,
        w: DIR_UP,
        s: DIR_DOWN,
        a: DIR_LEFT,
        d: DIR_RIGHT
    };

    function handleKeydown(e: KeyboardEvent) {
        const newDir = KEY_DIRS[e.key];
        if (newDir === undefined) return;

        e.preventDefault();
        press(newDir);

        if (status === 'idle') {
            void startGame();
        }
    }

    /* ── 터치 컨트롤 ── */
    let touchStart: Pos | null = null;

    function handleTouchStart(e: TouchEvent) {
        e.preventDefault();
        const touch = e.touches[0];
        touchStart = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchEnd(e: TouchEvent) {
        e.preventDefault();
        if (!touchStart) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStart.x;
        const dy = touch.clientY - touchStart.y;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (Math.max(absX, absY) < 20) return; // 너무 짧은 스와이프 무시

        if (absX > absY) {
            press(dx > 0 ? DIR_RIGHT : DIR_LEFT);
        } else {
            press(dy > 0 ? DIR_DOWN : DIR_UP);
        }

        if (status === 'idle') {
            void startGame();
        }
        touchStart = null;
    }

    /* ── 그리기 ── */
    function overlay(ctx: CanvasRenderingContext2D, alpha: number) {
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
    }

    function drawSnake(ctx: CanvasRenderingContext2D) {
        const snake = game.snake;
        const dir = game.dir;
        for (let i = snake.length - 1; i >= 0; i--) {
            const s = snake[i];
            const px = s.x * CELL;
            const py = s.y * CELL;
            const pad = 1;

            if (i === 0) {
                // 머리
                ctx.fillStyle = '#4ecca3';
                ctx.beginPath();
                ctx.roundRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, 5);
                ctx.fill();
                // 눈
                ctx.fillStyle = '#1a1a2e';
                const eyeSize = 3;
                if (dir === DIR_RIGHT || dir === DIR_LEFT) {
                    const ex = dir === DIR_RIGHT ? px + CELL - 6 : px + 4;
                    ctx.beginPath();
                    ctx.arc(ex, py + 6, eyeSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(ex, py + CELL - 6, eyeSize, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    const ey = dir === DIR_DOWN ? py + CELL - 6 : py + 4;
                    ctx.beginPath();
                    ctx.arc(px + 6, ey, eyeSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(px + CELL - 6, ey, eyeSize, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else {
                const alpha = 0.6 + 0.4 * (1 - i / snake.length);
                ctx.fillStyle = `rgba(78, 204, 163, ${alpha})`;
                ctx.beginPath();
                ctx.roundRect(
                    px + pad + 1,
                    py + pad + 1,
                    CELL - (pad + 1) * 2,
                    CELL - (pad + 1) * 2,
                    3
                );
                ctx.fill();
            }
        }
    }

    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const playing = status === 'playing' || status === 'over';

        // 배경
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);

        // 그리드 (은은하게)
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        for (let i = 0; i <= GRID; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL, 0);
            ctx.lineTo(i * CELL, H);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * CELL);
            ctx.lineTo(W, i * CELL);
            ctx.stroke();
        }

        // 먹이 (시작 전 화면은 기존처럼 가운데에 하나)
        const food = status === 'idle' ? { x: 10, y: 10 } : game.food;
        if (food) {
            const fx = food.x * CELL + CELL / 2;
            const fy = food.y * CELL + CELL / 2;
            ctx.fillStyle = '#ff6b6b';
            ctx.beginPath();
            ctx.arc(fx, fy, CELL * 0.4, 0, Math.PI * 2);
            ctx.fill();
            // 빛 효과
            ctx.fillStyle = 'rgba(255,107,107,0.3)';
            ctx.beginPath();
            ctx.arc(fx, fy, CELL * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // 뱀
        if (playing) drawSnake(ctx);

        // 게임 오버 오버레이
        if (status === 'over') {
            overlay(ctx, 0.6);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 28px sans-serif';
            ctx.fillText('Game Over', W / 2, H / 2 - 20);
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#ccc';
            ctx.fillText(`점수: ${game.score}`, W / 2, H / 2 + 15);
            ctx.font = '14px sans-serif';
            ctx.fillText('스페이스바 또는 탭하여 재시작', W / 2, H / 2 + 45);
        }

        // 시작 전
        if (status === 'idle') {
            overlay(ctx, 0.4);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText('🐍 뱀 게임', W / 2, H / 2 - 15);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#ccc';
            ctx.fillText('시작 버튼 또는 방향키로 시작', W / 2, H / 2 + 20);
        }

        // 서버 판 준비 중
        if (status === 'starting') {
            overlay(ctx, 0.4);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('준비 중…', W / 2, H / 2);
        }
    }

    // 처음 한 번 — 브라우저에 남긴 최고 점수 (SSR 에서는 돌지 않는다)
    $effect(() => {
        highScore = loadLocalBest();
    });

    $effect(() => {
        return () => {
            destroyed = true;
            stopTimer();
        };
    });

    function handleSpace(e: KeyboardEvent) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (status === 'over' || status === 'idle') {
                void startGame();
            }
        }
    }

    function init(_node: HTMLCanvasElement) {
        draw();
    }
</script>

<svelte:window onkeydown={handleKeydown} onkeyup={handleSpace} />

<div class="flex flex-col items-center gap-4">
    <!-- 컨트롤 -->
    <div class="flex items-center gap-4">
        <button
            onclick={() => void startGame()}
            disabled={status === 'starting'}
            class="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium disabled:opacity-60"
        >
            {status === 'playing' ? '다시 시작' : '시작'}
        </button>
        <div class="text-sm">
            <span class="text-foreground font-bold">점수: {score}</span>
            <span class="text-muted-foreground ml-2">최고: {highScore}</span>
        </div>
    </div>

    <!-- 랭킹 기록 안내 (한 줄 높이를 늘 잡아 둬서 아래가 밀리지 않게) -->
    <p class="text-muted-foreground min-h-4 text-center text-xs leading-4" aria-live="polite">
        {#if notice}
            {notice}
        {:else if status === 'over' && record === 'saving'}
            기록 저장 중…
        {:else if status === 'over' && record === 'saved' && standing?.accepted}
            <span class="text-foreground">
                내 최고 {standing.best.toLocaleString()}점{#if standing.rankWeek}
                    · 이번 주 {standing.rankWeek}위{/if}
            </span>
        {:else if !authStore.isAuthenticated}
            <a href="/login?redirect=%2Fgames%2Fsnake" class="text-primary underline"
                >로그인하면 랭킹에 기록됩니다</a
            >
        {:else if record === 'local' || record === 'failed' || record === 'saved'}
            기록 미등록
        {/if}
    </p>

    <!-- 캔버스 -->
    <canvas
        bind:this={canvas}
        width={W}
        height={H}
        class="max-w-full rounded-lg border shadow-md"
        style="aspect-ratio: 1/1;"
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
        use:init
    ></canvas>

    <!-- 모바일 방향키 -->
    <div class="grid grid-cols-3 gap-2 sm:hidden" style="width: 150px;">
        <div></div>
        <button
            class="bg-muted rounded-lg p-3 text-center text-lg active:opacity-70"
            onclick={() => press(DIR_UP)}>▲</button
        >
        <div></div>
        <button
            class="bg-muted rounded-lg p-3 text-center text-lg active:opacity-70"
            onclick={() => press(DIR_LEFT)}>◀</button
        >
        <button
            class="bg-muted rounded-lg p-3 text-center text-lg active:opacity-70"
            onclick={() => press(DIR_DOWN)}>▼</button
        >
        <button
            class="bg-muted rounded-lg p-3 text-center text-lg active:opacity-70"
            onclick={() => press(DIR_RIGHT)}>▶</button
        >
    </div>

    <p class="text-muted-foreground text-xs">방향키 또는 WASD로 조작 · 모바일: 스와이프</p>

    <SnakeRanking refresh={rankingRefresh} />
</div>

<style>
    canvas {
        touch-action: none;
    }
</style>
