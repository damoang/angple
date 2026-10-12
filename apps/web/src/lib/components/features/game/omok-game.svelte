<script lang="ts">
    // 오목 게임 - Gomoku (Five in a Row)
    // 포팅: /home/damoang/www/omok/js/main.js

    import { onDestroy } from 'svelte';
    import {
        SIZE,
        EMPTY,
        BLACK,
        WHITE,
        DIFFICULTIES,
        DIFFICULTY_SETTINGS,
        checkWin,
        createBoard,
        isDifficulty,
        type Difficulty
    } from '$lib/games/omok/ai';
    import { createAiClient } from '$lib/games/omok/ai-client';

    /* ── 상수 ── */
    const CELL = 36;
    const PAD = CELL;
    const W = PAD * 2 + (SIZE - 1) * CELL;
    const H = W;
    const STAR_POINTS = [3, 7, 11];
    const DIFFICULTY_KEY = 'angple_omok_difficulty';

    /* ── 상태 ── */
    let canvas: HTMLCanvasElement;
    let board = $state<number[][]>(createBoard());
    let currentPlayer = $state(BLACK);
    let gameOverState = $state(false);
    let winnerState = $state(0);
    let winningLine = $state<[number, number][]>([]);
    let moveCount = $state(0);
    let hoverPos = $state<{ x: number; y: number } | null>(null);
    let thinking = $state(false);
    let difficulty = $state<Difficulty>('medium');
    let lastMove = $state<{ x: number; y: number } | null>(null);
    let isSingle = $state(true);
    /** 새 판을 시작하면 오르는 번호 — 이전 판의 늦게 온 AI 수를 버린다 */
    let gameId = 0;

    // 고른 난이도 기억 — 저장소가 막힌 브라우저(사생활 모드 등)에서도 게임은 그대로 된다
    $effect(() => {
        try {
            const saved = localStorage.getItem(DIFFICULTY_KEY);
            if (isDifficulty(saved)) difficulty = saved;
        } catch {
            // 무시 — 기본값(중급)
        }
    });

    function saveDifficulty() {
        try {
            localStorage.setItem(DIFFICULTY_KEY, difficulty);
        } catch {
            // 무시
        }
    }

    // 고급 탐색은 Worker 에서 — 생각하는 동안에도 화면이 멈추지 않는다
    const ai = createAiClient();

    onDestroy(() => {
        gameId++;
        ai.dispose();
    });

    async function playAiMove(myGame: number) {
        if (myGame !== gameId) return;
        // $state 프록시는 Worker 로 못 보낸다 — 평범한 배열로 복사
        const snapshot = $state.snapshot(board);
        const move = await ai.request(snapshot, difficulty);
        // 그사이 「다시 시작」했으면 이전 판의 수는 버린다
        if (myGame !== gameId) return;
        if (gameOverState || board[move.y][move.x] !== EMPTY) {
            thinking = false;
            return;
        }
        board[move.y][move.x] = WHITE;
        moveCount++;
        lastMove = move;

        const aiWin = checkWin(board, move.x, move.y, WHITE);
        if (aiWin) {
            winningLine = aiWin;
            gameOverState = true;
            winnerState = WHITE;
        } else if (moveCount >= SIZE * SIZE) {
            gameOverState = true;
            winnerState = 0;
        } else {
            currentPlayer = BLACK;
        }
        board = [...board];
        thinking = false;
    }

    /* ── 돌 놓기 ── */
    function placeStone(x: number, y: number) {
        if (board[y][x] !== EMPTY || gameOverState || thinking) return;
        if (isSingle && currentPlayer !== BLACK) return;

        board[y][x] = currentPlayer;
        moveCount++;
        lastMove = { x, y };

        const win = checkWin(board, x, y, currentPlayer);
        if (win) {
            winningLine = win;
            gameOverState = true;
            winnerState = currentPlayer;
            board = [...board];
            return;
        }

        if (moveCount >= SIZE * SIZE) {
            gameOverState = true;
            winnerState = 0;
            board = [...board];
            return;
        }

        currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
        board = [...board];

        if (isSingle && currentPlayer === WHITE) {
            thinking = true;
            // 사람 돌이 먼저 그려지도록 한 박자 쉬고 생각한다
            const myGame = gameId;
            setTimeout(() => void playAiMove(myGame), 150);
        }
    }

    /* ── 클릭 ── */
    function handleClick(e: MouseEvent) {
        if (gameOverState || thinking) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const gx = Math.round((cx - PAD) / CELL);
        const gy = Math.round((cy - PAD) / CELL);
        if (gx >= 0 && gx < SIZE && gy >= 0 && gy < SIZE) {
            placeStone(gx, gy);
        }
    }

    function handleMouseMove(e: MouseEvent) {
        if (gameOverState || thinking) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top) * scaleY;
        const gx = Math.round((cx - PAD) / CELL);
        const gy = Math.round((cy - PAD) / CELL);
        if (gx >= 0 && gx < SIZE && gy >= 0 && gy < SIZE && board[gy][gx] === EMPTY) {
            hoverPos = { x: gx, y: gy };
        } else {
            hoverPos = null;
        }
    }

    /* ── 그리기 ── */
    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

        // 배경 (나무 질감)
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, '#D4A054');
        bgGrad.addColorStop(0.5, '#C89545');
        bgGrad.addColorStop(1, '#BA8A3A');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 내부 판
        ctx.fillStyle = '#C8944A';
        ctx.fillRect(PAD - 8, PAD - 8, (SIZE - 1) * CELL + 16, (SIZE - 1) * CELL + 16);

        // 격자
        ctx.strokeStyle = 'rgba(80, 50, 20, 0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < SIZE; i++) {
            ctx.beginPath();
            ctx.moveTo(PAD, PAD + i * CELL);
            ctx.lineTo(PAD + (SIZE - 1) * CELL, PAD + i * CELL);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(PAD + i * CELL, PAD);
            ctx.lineTo(PAD + i * CELL, PAD + (SIZE - 1) * CELL);
            ctx.stroke();
        }

        // 화점 (star points)
        for (const sy of STAR_POINTS) {
            for (const sx of STAR_POINTS) {
                ctx.fillStyle = 'rgba(80, 50, 20, 0.9)';
                ctx.beginPath();
                ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 호버 미리보기
        if (hoverPos && board[hoverPos.y][hoverPos.x] === EMPTY) {
            ctx.fillStyle = currentPlayer === BLACK ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(PAD + hoverPos.x * CELL, PAD + hoverPos.y * CELL, CELL * 0.43, 0, Math.PI * 2);
            ctx.fill();
        }

        // 돌 그리기
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                const stone = board[y][x];
                if (stone === EMPTY) continue;
                const px = PAD + x * CELL;
                const py = PAD + y * CELL;
                const r = CELL * 0.43;

                // 그림자
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath();
                ctx.arc(px + 2, py + 2, r, 0, Math.PI * 2);
                ctx.fill();

                // 돌
                const grad = ctx.createRadialGradient(
                    px - r * 0.3,
                    py - r * 0.3,
                    r * 0.1,
                    px,
                    py,
                    r
                );
                if (stone === BLACK) {
                    grad.addColorStop(0, '#444');
                    grad.addColorStop(0.5, '#222');
                    grad.addColorStop(1, '#000');
                } else {
                    grad.addColorStop(0, '#FFF');
                    grad.addColorStop(0.5, '#F0F0F0');
                    grad.addColorStop(1, '#DDD');
                }
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = stone === BLACK ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // 마지막 수 표시
                if (lastMove && lastMove.x === x && lastMove.y === y) {
                    ctx.fillStyle =
                        stone === BLACK ? 'rgba(100,150,255,0.8)' : 'rgba(200,50,50,0.8)';
                    ctx.beginPath();
                    ctx.arc(px, py, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 승리 라인 하이라이트
        if (winningLine.length > 0) {
            for (const [wx, wy] of winningLine) {
                ctx.strokeStyle =
                    winnerState === BLACK ? 'rgba(0,100,255,0.8)' : 'rgba(220,20,60,0.8)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(PAD + wx * CELL, PAD + wy * CELL, CELL * 0.43 + 3, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    $effect(() => {
        board;
        hoverPos;
        winningLine;
        draw();
    });

    function startGame() {
        gameId++;
        board = createBoard();
        currentPlayer = BLACK;
        gameOverState = false;
        winnerState = 0;
        winningLine = [];
        moveCount = 0;
        hoverPos = null;
        thinking = false;
        lastMove = null;
    }

    function init(_node: HTMLCanvasElement) {
        startGame();
    }
</script>

<div class="flex flex-col items-center gap-4">
    <!-- 컨트롤 -->
    <div class="flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-sm">
            <input type="radio" bind:group={isSingle} value={true} />
            <span>1인 (vs AI)</span>
        </label>
        <label class="flex items-center gap-2 text-sm">
            <input type="radio" bind:group={isSingle} value={false} />
            <span>2인 대전</span>
        </label>
        {#if isSingle}
            <select
                bind:value={difficulty}
                onchange={saveDifficulty}
                aria-label="AI 난이도"
                class="border-border bg-background text-foreground rounded border px-2 py-1 text-sm"
            >
                {#each DIFFICULTIES as d (d)}
                    <option value={d}>{DIFFICULTY_SETTINGS[d].label}</option>
                {/each}
            </select>
        {/if}
        <button
            onclick={startGame}
            class="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium"
        >
            다시 시작
        </button>
    </div>

    <!-- 상태 -->
    <div class="text-sm font-medium">
        {#if gameOverState}
            {#if winnerState === BLACK}
                <span class="text-foreground text-lg font-bold">⚫ 흑돌 승리!</span>
            {:else if winnerState === WHITE}
                <span class="text-foreground text-lg font-bold">⚪ 백돌 승리!</span>
            {:else}
                <span class="text-muted-foreground text-lg font-bold">무승부</span>
            {/if}
        {:else if thinking}
            <span class="text-muted-foreground animate-pulse">AI 생각 중...</span>
        {:else}
            <span class="text-foreground"
                >{currentPlayer === BLACK ? '⚫ 흑돌 차례' : '⚪ 백돌 차례'}</span
            >
        {/if}
        <span class="text-muted-foreground ml-2 text-xs">({moveCount}수)</span>
    </div>

    <!-- 캔버스 -->
    <canvas
        bind:this={canvas}
        width={W}
        height={H}
        class="max-w-full cursor-pointer rounded-lg border shadow-md"
        style="aspect-ratio: 1/1;"
        onclick={handleClick}
        onmousemove={handleMouseMove}
        onmouseleave={() => (hoverPos = null)}
        use:init
    ></canvas>
</div>

<style>
    canvas {
        touch-action: none;
    }
</style>
