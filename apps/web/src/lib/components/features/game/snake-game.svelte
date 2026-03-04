<script lang="ts">
    // 뱀 게임 - Snake Game
    // 포팅: /home/damoang/www/502_snake.html

    /* ── 상수 ── */
    const GRID = 20;
    const CELL = 20;
    const W = GRID * CELL;
    const H = GRID * CELL;
    const BASE_SPEED = 150;

    type Dir = 'up' | 'down' | 'left' | 'right';
    type Pos = { x: number; y: number };

    /* ── 상태 ── */
    let canvas: HTMLCanvasElement;
    let snake = $state<Pos[]>([]);
    let food = $state<Pos>({ x: 10, y: 10 });
    let dir = $state<Dir>('right');
    let nextDir = $state<Dir>('right');
    let running = $state(false);
    let gameOverState = $state(false);
    let score = $state(0);
    let highScore = $state(0);
    let timer: ReturnType<typeof setInterval> | null = null;

    function speed(): number {
        return Math.max(60, BASE_SPEED - Math.floor(score / 3) * 5);
    }

    function randomFood(): Pos {
        const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
        let pos: Pos;
        do {
            pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
        } while (occupied.has(`${pos.x},${pos.y}`));
        return pos;
    }

    function startGame() {
        const mid = Math.floor(GRID / 2);
        snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid }
        ];
        dir = 'right';
        nextDir = 'right';
        food = randomFood();
        score = 0;
        gameOverState = false;
        running = true;

        if (timer) clearInterval(timer);
        tick();
    }

    function tick() {
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            if (!running || gameOverState) return;
            step();
        }, speed());
    }

    function step() {
        dir = nextDir;
        const head = { ...snake[0] };

        switch (dir) {
            case 'up':
                head.y--;
                break;
            case 'down':
                head.y++;
                break;
            case 'left':
                head.x--;
                break;
            case 'right':
                head.x++;
                break;
        }

        // 벽 충돌
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
            endGame();
            return;
        }

        // 자기 몸 충돌
        if (snake.some((s) => s.x === head.x && s.y === head.y)) {
            endGame();
            return;
        }

        const newSnake = [head, ...snake];

        // 먹이
        if (head.x === food.x && head.y === food.y) {
            score++;
            food = randomFood();
            // 속도 변경
            tick();
        } else {
            newSnake.pop();
        }

        snake = newSnake;
    }

    function endGame() {
        gameOverState = true;
        running = false;
        if (timer) clearInterval(timer);
        if (score > highScore) highScore = score;
    }

    function handleKeydown(e: KeyboardEvent) {
        const keyMap: Record<string, Dir> = {
            ArrowUp: 'up',
            ArrowDown: 'down',
            ArrowLeft: 'left',
            ArrowRight: 'right',
            w: 'up',
            s: 'down',
            a: 'left',
            d: 'right'
        };
        const newDir = keyMap[e.key];
        if (!newDir) return;

        e.preventDefault();

        // 반대 방향 차단
        const opposites: Record<Dir, Dir> = {
            up: 'down',
            down: 'up',
            left: 'right',
            right: 'left'
        };
        if (newDir !== opposites[dir]) {
            nextDir = newDir;
        }

        if (!running && !gameOverState) {
            startGame();
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

        let newDir: Dir;
        if (absX > absY) {
            newDir = dx > 0 ? 'right' : 'left';
        } else {
            newDir = dy > 0 ? 'down' : 'up';
        }

        const opposites: Record<Dir, Dir> = {
            up: 'down',
            down: 'up',
            left: 'right',
            right: 'left'
        };
        if (newDir !== opposites[dir]) {
            nextDir = newDir;
        }

        if (!running && !gameOverState) {
            startGame();
        }
        touchStart = null;
    }

    /* ── 그리기 ── */
    function draw() {
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;

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

        // 먹이
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

        // 뱀
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
                if (dir === 'right' || dir === 'left') {
                    const ex = dir === 'right' ? px + CELL - 6 : px + 4;
                    ctx.beginPath();
                    ctx.arc(ex, py + 6, eyeSize, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(ex, py + CELL - 6, eyeSize, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    const ey = dir === 'down' ? py + CELL - 6 : py + 4;
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

        // 게임 오버 오버레이
        if (gameOverState) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 28px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Game Over', W / 2, H / 2 - 20);
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#ccc';
            ctx.fillText(`점수: ${score}`, W / 2, H / 2 + 15);
            ctx.font = '14px sans-serif';
            ctx.fillText('스페이스바 또는 탭하여 재시작', W / 2, H / 2 + 45);
        }

        // 시작 전
        if (!running && !gameOverState && snake.length === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, W, H);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🐍 뱀 게임', W / 2, H / 2 - 15);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#ccc';
            ctx.fillText('시작 버튼 또는 방향키로 시작', W / 2, H / 2 + 20);
        }
    }

    $effect(() => {
        snake;
        food;
        gameOverState;
        draw();
    });

    $effect(() => {
        return () => {
            if (timer) clearInterval(timer);
        };
    });

    function handleSpace(e: KeyboardEvent) {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (gameOverState || !running) {
                startGame();
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
            onclick={startGame}
            class="bg-primary text-primary-foreground rounded-md px-4 py-1.5 text-sm font-medium"
        >
            {gameOverState || !running ? '시작' : '다시 시작'}
        </button>
        <div class="text-sm">
            <span class="text-foreground font-bold">점수: {score}</span>
            <span class="text-muted-foreground ml-2">최고: {highScore}</span>
        </div>
    </div>

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
            onclick={() => {
                if (dir !== 'down') nextDir = 'up';
            }}>▲</button
        >
        <div></div>
        <button
            class="bg-muted rounded-lg p-3 text-center text-lg active:opacity-70"
            onclick={() => {
                if (dir !== 'right') nextDir = 'left';
            }}>◀</button
        >
        <button
            class="bg-muted rounded-lg p-3 text-center text-lg active:opacity-70"
            onclick={() => {
                if (dir !== 'up') nextDir = 'down';
            }}>▼</button
        >
        <button
            class="bg-muted rounded-lg p-3 text-center text-lg active:opacity-70"
            onclick={() => {
                if (dir !== 'left') nextDir = 'right';
            }}>▶</button
        >
    </div>

    <p class="text-muted-foreground text-xs">방향키 또는 WASD로 조작 · 모바일: 스와이프</p>
</div>

<style>
    canvas {
        touch-action: none;
    }
</style>
