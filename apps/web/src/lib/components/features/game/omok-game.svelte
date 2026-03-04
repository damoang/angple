<script lang="ts">
    // 오목 게임 - Gomoku (Five in a Row)
    // 포팅: /home/damoang/www/omok/js/main.js

    /* ── 상수 ── */
    const SIZE = 15;
    const CELL = 36;
    const PAD = CELL;
    const W = PAD * 2 + (SIZE - 1) * CELL;
    const H = W;
    const EMPTY = 0,
        BLACK = 1,
        WHITE = 2;
    const STAR_POINTS = [3, 7, 11];

    type Difficulty = 'easy' | 'medium' | 'hard';

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

    function createBoard(): number[][] {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    }

    /* ── 승리 판정 ── */
    function checkWin(
        b: number[][],
        x: number,
        y: number,
        player: number
    ): [number, number][] | null {
        const dirs: [number, number][] = [
            [1, 0],
            [0, 1],
            [1, 1],
            [1, -1]
        ];
        for (const [dx, dy] of dirs) {
            const line: [number, number][] = [[x, y]];
            for (let d = 1; d < 5; d++) {
                const nx = x + dx * d,
                    ny = y + dy * d;
                if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || b[ny][nx] !== player) break;
                line.push([nx, ny]);
            }
            for (let d = 1; d < 5; d++) {
                const nx = x - dx * d,
                    ny = y - dy * d;
                if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE || b[ny][nx] !== player) break;
                line.push([nx, ny]);
            }
            if (line.length >= 5) return line;
        }
        return null;
    }

    /* ── AI ── */
    const PATTERNS: Record<string, number> = {
        '11111': 1000000,
        '011110': 50000,
        '011112': 5000,
        '211110': 5000,
        '01110': 5000,
        '010110': 3000,
        '011010': 3000,
        '001112': 500,
        '211100': 500,
        '00110': 500,
        '01100': 500,
        '01010': 500,
        '010010': 300
    };

    function evaluateDir(
        b: number[][],
        x: number,
        y: number,
        dx: number,
        dy: number,
        player: number
    ): number {
        // 해당 방향 라인 추출 (최대 9칸)
        let line = '';
        for (let i = -4; i <= 4; i++) {
            const nx = x + dx * i,
                ny = y + dy * i;
            if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) {
                line += '2';
            } else if (b[ny][nx] === player) {
                line += '1';
            } else if (b[ny][nx] === EMPTY) {
                line += '0';
            } else {
                line += '2';
            }
        }
        let score = 0;
        for (const [pat, val] of Object.entries(PATTERNS)) {
            let idx = 0;
            while ((idx = line.indexOf(pat, idx)) !== -1) {
                score += val;
                idx++;
            }
        }
        return score;
    }

    function evaluatePosition(b: number[][], x: number, y: number, player: number): number {
        let score = 0;
        const dirs: [number, number][] = [
            [1, 0],
            [0, 1],
            [1, 1],
            [1, -1]
        ];
        for (const [dx, dy] of dirs) {
            score += evaluateDir(b, x, y, dx, dy, player);
        }
        // 중앙 보너스
        const center = Math.floor(SIZE / 2);
        const dist = Math.abs(x - center) + Math.abs(y - center);
        score += Math.max(0, (14 - dist) * 2);
        return score;
    }

    function getAiMove(b: number[][]): { x: number; y: number } {
        const depthMap: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
        const depth = depthMap[difficulty];

        // 후보 위치: 기존 돌 근처 2칸 이내
        const candidates = new Set<string>();
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (b[y][x] !== EMPTY) {
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const nx = x + dx,
                                ny = y + dy;
                            if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && b[ny][nx] === EMPTY)
                                candidates.add(`${nx},${ny}`);
                        }
                    }
                }
            }
        }

        if (candidates.size === 0) {
            return { x: 7, y: 7 }; // 첫 수: 정중앙
        }

        let bestScore = -Infinity;
        let bestMove = { x: 7, y: 7 };

        for (const key of candidates) {
            const [cx, cy] = key.split(',').map(Number);

            // 즉시 승리 체크
            b[cy][cx] = WHITE;
            if (checkWin(b, cx, cy, WHITE)) {
                b[cy][cx] = EMPTY;
                return { x: cx, y: cy };
            }
            b[cy][cx] = EMPTY;

            // 상대 즉시 승리 차단
            b[cy][cx] = BLACK;
            if (checkWin(b, cx, cy, BLACK)) {
                b[cy][cx] = EMPTY;
                bestMove = { x: cx, y: cy };
                bestScore = 999999;
                continue;
            }
            b[cy][cx] = EMPTY;

            // 평가
            b[cy][cx] = WHITE;
            let score = evaluatePosition(b, cx, cy, WHITE) * 1.1;
            b[cy][cx] = EMPTY;

            b[cy][cx] = BLACK;
            score += evaluatePosition(b, cx, cy, BLACK);
            b[cy][cx] = EMPTY;

            if (depth >= 2) {
                // 간단한 2수 선읽기
                b[cy][cx] = WHITE;
                let threatBonus = 0;
                for (const key2 of candidates) {
                    if (key2 === key) continue;
                    const [cx2, cy2] = key2.split(',').map(Number);
                    if (b[cy2][cx2] !== EMPTY) continue;
                    b[cy2][cx2] = WHITE;
                    if (checkWin(b, cx2, cy2, WHITE)) threatBonus += 10000;
                    b[cy2][cx2] = EMPTY;
                }
                score += threatBonus * 0.5;
                b[cy][cx] = EMPTY;
            }

            // 난이도별 랜덤
            if (difficulty === 'easy') score += Math.random() * 2000;
            else if (difficulty === 'medium') score += Math.random() * 200;

            if (score > bestScore) {
                bestScore = score;
                bestMove = { x: cx, y: cy };
            }
        }

        return bestMove;
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
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const move = getAiMove(board);
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
                }, 150);
            });
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
            <select bind:value={difficulty} class="border-border rounded border px-2 py-1 text-sm">
                <option value="easy">쉬움</option>
                <option value="medium">보통</option>
                <option value="hard">어려움</option>
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
