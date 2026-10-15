<script lang="ts">
    // 뱀 게임 - Snake Game
    // 규칙은 $lib/games/snake/engine.ts (결정적 — 서버가 같은 규칙으로 기록을 다시 돌려 본다).
    // 로그인 상태면 서버(stack-ws)에서 시드를 받아 시작하고 끝나면 입력 기록을 내 랭킹에 올린다.
    // 비로그인·실패·3초 안에 답이 없으면 로컬 무작위 시드로 그대로 진행한다(「기록 미등록」).
    // 다음 판은 뒤에서 미리 받아 두어 다시 시작할 때 기다리지 않는다(못 받았으면 그 판은 로컬로 바로 시작).
    import { untrack } from 'svelte';
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
        type SnakeFinishResult,
        type SnakeRun
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
    // eslint-disable-next-line svelte/prefer-writable-derived -- 브라우저 저장값은 마운트 뒤 한 번 읽고 게임 중에도 직접 갱신한다 — SSR 에서 저장소를 읽지 않게 유지
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
    /** 이번 방문에서 한 판이라도 시작했는가 — 첫 판만 서버 판을 잠깐(최대 3초) 기다린다 */
    let played = false;
    /** 마지막으로 서버에 판 시작을 요청한 시각 — 서버의 시작 간격 제한을 피해 기다린다 */
    let lastServerStart = 0;
    /** 미리 받아 둔 다음 판 (받은 시각과 함께) */
    let ready: { run: SnakeRun; at: number } | null = null;
    /** 다음 판을 받아 오는 중이면 그 작업 */
    let fetching: Promise<void> | null = null;
    /** 끝난 판 기록을 내는 중이면 그 작업 — 새 판 요청은 이게 끝난 뒤에(서버는 회원당 판 1개) */
    let submitting: Promise<void> | null = null;

    /** 서버 시작 간격(5초)에 더 두는 여유 */
    const GAP_MARGIN_MS = 1000;
    /** 첫 판이 서버 판을 기다리는 최대 시간 */
    const FIRST_START_WAIT_MS = 3000;
    /** 미리 받은 판을 쓰는 최대 나이 — 서버 만료(2시간)보다 넉넉히 짧게 */
    const READY_MAX_AGE_MS = 60 * 60 * 1000;

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

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * 다음 판을 뒤에서 미리 받아 둔다 — 로그인 회원만. 서버의 시작 간격(5초 + 여유 1초)을 지켜서 부르고,
     * 그래도 간격 제한(429)이면 「아직 아님」으로 보고 간격만큼 기다려 한 번 더 부른다.
     * 다시 시작할 때 기다리지 않게 하려는 것이다(받지 못했으면 그 판은 로컬로 바로 시작).
     */
    function prefetch(): Promise<void> {
        if (fetching) return fetching;
        if (ready || destroyed || !authStore.isAuthenticated) return Promise.resolve();
        const work = (async () => {
            if (submitting) await submitting;
            for (let attempt = 0; attempt < 2; attempt++) {
                const wait = lastServerStart + SNAKE_START_GAP_MS + GAP_MARGIN_MS - Date.now();
                if (wait > 0) await sleep(wait);
                if (destroyed) return;
                lastServerStart = Date.now();
                const r = await startSnakeRun(getStackToken);
                if (destroyed) return;
                if (r === 'rate_limited') continue;
                if (r) ready = { run: r, at: Date.now() };
                return;
            }
        })().finally(() => {
            fetching = null;
        });
        fetching = work;
        return work;
    }

    /** 미리 받은 판을 꺼낸다(한 번만). 너무 오래됐으면 버린다 */
    function takeReady(): SnakeRun | null {
        const r = ready;
        ready = null;
        if (!r || !authStore.isAuthenticated) return null;
        return Date.now() - r.at < READY_MAX_AGE_MS ? r.run : null;
    }

    async function startGame() {
        if (status === 'starting') return;
        stopTimer();
        const gen = ++startGen;
        runId = null;
        standing = null;
        notice = '';
        let run = takeReady();
        if (!run && !played && authStore.isAuthenticated) {
            // 첫 판만 — 받아 오는 중인 판을 잠깐 기다린다(최대 3초)
            status = 'starting';
            draw();
            await Promise.race([prefetch(), sleep(FIRST_START_WAIT_MS)]);
            if (gen !== startGen || destroyed) return;
            run = takeReady();
        }
        if (run) {
            runId = run.runId;
        } else if (authStore.isAuthenticated) {
            notice = played
                ? '기록 준비 전에 시작해 이번 판은 랭킹에 기록되지 않습니다'
                : '기록 서버에 연결하지 못해 이번 판은 랭킹에 기록되지 않습니다';
        }
        played = true;
        record = runId ? 'server' : 'local';
        game = createGame(run ? run.seed : newSeed());
        nextDir = DIR_RIGHT;
        inputs = [];
        score = 0;
        status = 'playing';
        draw();
        tick();
        // 로컬 판이면 지금부터 다음 판을 받아 둔다(서버 판 진행 중에는 부르지 않는다 — 판이 바뀌므로)
        if (!runId) void prefetch();
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
        // 기록을 낸 뒤 다음 판을 받아 둔다 — 다시 시작할 때 기다리지 않게
        submitting = submitRecord().finally(() => {
            submitting = null;
        });
        void submitting.then(() => prefetch());
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

    // 로그인 상태가 확인되면 첫 판을 미리 받아 둔다(시작 버튼을 누를 때 기다리지 않게)
    // 로그아웃하면 미리 받아 둔 판을 버린다(다른 회원 판으로 기록되지 않게)
    $effect(() => {
        if (authStore.isAuthenticated) {
            untrack(() => {
                if (status === 'idle') void prefetch();
            });
        } else {
            ready = null;
        }
    });

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
