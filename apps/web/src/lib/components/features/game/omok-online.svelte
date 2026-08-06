<script lang="ts">
    /**
     * 오목 온라인 대전 (WebSocket).
     *
     * 서버: cmd/omok-ws (angple-backend) — 착수 유효성·승패 판정은 전부 서버가 한다.
     * 이 컴포넌트는 좌표를 보내고 서버가 확정한 상태를 그린다.
     *
     * ⛔ 참가비 1,000P 가 걸리므로 큐 진입 전에 반드시 동의를 받는다.
     *    포인트가 조용히 빠져나가는 화면은 만들지 않는다.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import { onDestroy } from 'svelte';

    const SIZE = 15;
    const CELL = 32;
    const PAD = CELL;
    const W = PAD * 2 + (SIZE - 1) * CELL;

    type Phase = 'idle' | 'connecting' | 'queued' | 'playing' | 'over';

    let phase = $state<Phase>('idle');
    let board = $state<number[][]>(emptyBoard());
    let myColor = $state(0);
    let currentPlayer = $state(1);
    let roomId = $state('');
    let opponent = $state<{ nickname?: string; rating?: number } | null>(null);
    let message = $state('');
    let entryFee = $state(1000);
    let queuePosition = $state(0);
    let turnLeft = $state(0);
    let result = $state<{ youWon: boolean; reason: string } | null>(null);
    let myStats = $state<{ wins: number; losses: number; draws: number; rating: number } | null>(
        null
    );
    let agreed = $state(false);
    let socket: WebSocket | null = null;
    let turnTimer: ReturnType<typeof setInterval> | null = null;

    const isMyTurn = $derived(phase === 'playing' && currentPlayer === myColor);

    function emptyBoard(): number[][] {
        return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    }

    function wsUrl(): string {
        const token = authStore.accessToken ?? '';
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 브라우저 WebSocket 은 헤더를 못 붙여서 토큰을 쿼리로 전달한다(서버가 둘 다 받는다).
        return `${proto}//${location.host}/omok-ws/?token=${encodeURIComponent(token)}`;
    }

    function send(type: string, data: Record<string, unknown> = {}) {
        socket?.send(JSON.stringify({ type, data }));
    }

    function startTurnCountdown(seconds: number) {
        if (turnTimer) clearInterval(turnTimer);
        turnLeft = seconds;
        turnTimer = setInterval(() => {
            turnLeft = Math.max(0, turnLeft - 1);
            if (turnLeft === 0 && turnTimer) {
                clearInterval(turnTimer);
                turnTimer = null;
            }
        }, 1000);
    }

    // ⛔ 동의 전에는 버튼을 비활성으로 두지 않는다 — 눌러도 아무 일이 없으면
    //    이용자는 "기능이 고장났다" 로 받아들인다. 누르면 이유를 말해준다.
    function tryConnect(mode: 'random' | 'rating') {
        if (!agreed) {
            message = '참가비 안내를 확인하신 뒤 아래 체크박스를 눌러 주세요.';
            return;
        }
        connect(mode);
    }

    function connect(mode: 'random' | 'rating') {
        if (!authStore.isAuthenticated) {
            message = '로그인 후 이용할 수 있습니다.';
            return;
        }
        if (!authStore.accessToken) {
            // 토큰이 아직 클라이언트에 없으면 연결해도 401 로 끊긴다.
            // 원인을 화면에 밝혀 "눌러도 아무 일이 없다" 를 없앤다.
            message = '로그인 정보를 불러오는 중입니다. 잠시 후 다시 눌러 주세요.';
            return;
        }
        phase = 'connecting';
        message = '';
        try {
            socket = new WebSocket(wsUrl());
        } catch {
            message = '대전 서버 주소에 연결할 수 없습니다.';
            phase = 'idle';
            return;
        }

        socket.onopen = () => send('join_matching_queue', { mode });
        socket.onerror = () => {
            message = '대전 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            phase = 'idle';
        };
        socket.onclose = (ev) => {
            // 정상 종료가 아니면 이유를 남긴다 — 조용히 idle 로 돌아가면
            // 이용자는 "버튼이 안 먹는다" 로만 느낀다.
            if (phase === 'connecting' && !message) {
                message =
                    ev.code === 1006
                        ? '대전 서버와 연결이 끊겼습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.'
                        : `연결이 종료되었습니다. (코드 ${ev.code})`;
            }
            if (phase !== 'over') phase = 'idle';
        };
        socket.onmessage = (ev) => {
            let msg: Record<string, unknown>;
            try {
                msg = JSON.parse(ev.data);
            } catch {
                return;
            }
            handleMessage(msg);
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleMessage(msg: any) {
        switch (msg.type) {
            case 'connected':
                entryFee = msg.entryFee ?? 1000;
                myStats = msg.stats ?? null;
                break;
            case 'matching_status':
                if (msg.status === 'queued') {
                    phase = 'queued';
                    queuePosition = msg.position ?? 0;
                    entryFee = msg.entryFee ?? entryFee;
                } else if (msg.status === 'matched') {
                    roomId = msg.roomId;
                    opponent = msg.opponent ?? null;
                } else if (msg.status === 'error') {
                    message = msg.message ?? '매칭에 실패했습니다.';
                    phase = 'idle';
                    close();
                }
                break;
            case 'game_start':
                phase = 'playing';
                board = msg.gameState?.board ?? emptyBoard();
                myColor = msg.playerColor ?? 0;
                currentPlayer = msg.gameState?.currentPlayer ?? 1;
                startTurnCountdown(msg.turnSeconds ?? 60);
                break;
            case 'move':
                board[msg.y][msg.x] = msg.player;
                board = board;
                currentPlayer = msg.currentPlayer ?? currentPlayer;
                startTurnCountdown(60);
                break;
            case 'game_restored':
                phase = 'playing';
                board = msg.gameState?.board ?? board;
                myColor = msg.gameState?.playerColor ?? myColor;
                currentPlayer = msg.gameState?.currentPlayer ?? currentPlayer;
                message = '대국에 다시 연결했습니다.';
                break;
            case 'opponent_disconnected':
                message = msg.message ?? '상대방의 연결이 끊겼습니다.';
                break;
            case 'opponent_reconnected':
                message = '상대방이 다시 접속했습니다.';
                break;
            case 'game_over':
                phase = 'over';
                result = { youWon: !!msg.youWon, reason: msg.reason ?? '' };
                myStats = msg.stats ?? myStats;
                if (msg.message) message = msg.message;
                if (turnTimer) {
                    clearInterval(turnTimer);
                    turnTimer = null;
                }
                break;
            case 'error':
                message = msg.message ?? '';
                break;
        }
    }

    function play(x: number, y: number) {
        if (!isMyTurn || board[y][x] !== 0) return;
        send('move', { roomId, x, y });
    }

    function surrender() {
        if (!confirm('기권하시겠습니까? 패배로 기록됩니다.')) return;
        send('surrender', { roomId });
    }

    function cancelQueue() {
        send('cancel_matching');
        phase = 'idle';
        close();
    }

    function close() {
        socket?.close();
        socket = null;
        if (turnTimer) {
            clearInterval(turnTimer);
            turnTimer = null;
        }
    }

    function resetToIdle() {
        board = emptyBoard();
        result = null;
        opponent = null;
        roomId = '';
        phase = 'idle';
        close();
    }

    onDestroy(close);

    const reasonText: Record<string, string> = {
        five: '오목 완성',
        resign: '기권',
        timeout: '시간 초과',
        disconnect: '상대 이탈',
        draw: '무승부'
    };
</script>

<Card.Root>
    <Card.Header>
        <Card.Title class="flex items-center gap-2 text-base">
            온라인 대전
            {#if myStats}
                <Badge variant="secondary">
                    {myStats.wins}승 {myStats.losses}패 · {myStats.rating}
                </Badge>
            {/if}
        </Card.Title>
        <Card.Description>
            같은 시간에 접속한 앙님과 겨룹니다. 참가비 <b>{entryFee.toLocaleString()}P</b>가
            필요합니다.
        </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-3">
        {#if message}
            <p class="text-sm text-amber-600 dark:text-amber-400">{message}</p>
        {/if}

        {#if phase === 'idle'}
            <div class="space-y-3 rounded-lg border p-4">
                <p class="text-sm">
                    대국이 시작되면 <b>{entryFee.toLocaleString()}P가 차감</b>됩니다. 참가비는
                    돌려받지 못하며 승패는 전적과 점수에만 반영됩니다. 자리를 비우거나 창을 닫으면
                    <b>패배로 처리</b>됩니다.
                </p>
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" bind:checked={agreed} class="h-4 w-4" />
                    위 내용을 확인했습니다.
                </label>
                <div class="flex flex-wrap gap-2">
                    <Button onclick={() => tryConnect('random')}>바로 대전</Button>
                    <Button variant="outline" onclick={() => tryConnect('rating')}>
                        비슷한 실력끼리
                    </Button>
                </div>
            </div>
        {:else if phase === 'connecting'}
            <p class="text-muted-foreground text-sm">대전 서버에 연결 중…</p>
        {:else if phase === 'queued'}
            <div class="space-y-2 rounded-lg border p-4">
                <p class="text-sm">상대를 찾고 있습니다… (대기 {queuePosition}번째)</p>
                <p class="text-muted-foreground text-xs">
                    매칭이 되는 순간 참가비가 차감됩니다. 아직 차감되지 않았습니다.
                </p>
                <Button variant="ghost" size="sm" onclick={cancelQueue}>취소</Button>
            </div>
        {/if}

        {#if phase === 'playing' || phase === 'over'}
            <div class="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={myColor === 1 ? 'default' : 'secondary'}>
                    나 · {myColor === 1 ? '흑' : '백'}
                </Badge>
                <span class="text-muted-foreground">vs</span>
                <Badge variant="outline">
                    {opponent?.nickname ?? '상대'}{opponent?.rating ? ` (${opponent.rating})` : ''}
                </Badge>
                {#if phase === 'playing'}
                    <span
                        class="ml-auto {isMyTurn
                            ? 'font-semibold text-emerald-600'
                            : 'text-muted-foreground'}"
                    >
                        {isMyTurn ? `내 차례 · ${turnLeft}초` : '상대 차례'}
                    </span>
                {/if}
            </div>

            <div class="overflow-x-auto">
                <svg
                    viewBox="0 0 {W} {W}"
                    style="width:{W}px;max-width:100%"
                    class="rounded bg-amber-100"
                >
                    {#each Array(SIZE) as _, i (i)}
                        <line
                            x1={PAD}
                            y1={PAD + i * CELL}
                            x2={W - PAD}
                            y2={PAD + i * CELL}
                            stroke="#8b5e34"
                            stroke-width="1"
                        />
                        <line
                            x1={PAD + i * CELL}
                            y1={PAD}
                            x2={PAD + i * CELL}
                            y2={W - PAD}
                            stroke="#8b5e34"
                            stroke-width="1"
                        />
                    {/each}
                    {#each board as row, y (y)}
                        {#each row as cell, x (x)}
                            {#if cell !== 0}
                                <circle
                                    cx={PAD + x * CELL}
                                    cy={PAD + y * CELL}
                                    r={CELL * 0.42}
                                    fill={cell === 1 ? '#111' : '#fff'}
                                    stroke="#333"
                                />
                            {:else if phase === 'playing'}
                                <rect
                                    x={PAD + x * CELL - CELL / 2}
                                    y={PAD + y * CELL - CELL / 2}
                                    width={CELL}
                                    height={CELL}
                                    fill="transparent"
                                    class={isMyTurn ? 'cursor-pointer' : 'cursor-not-allowed'}
                                    role="button"
                                    tabindex="-1"
                                    aria-label={`${x + 1}, ${y + 1} 에 두기`}
                                    onclick={() => play(x, y)}
                                    onkeydown={(e) => e.key === 'Enter' && play(x, y)}
                                />
                            {/if}
                        {/each}
                    {/each}
                </svg>
            </div>

            {#if phase === 'playing'}
                <Button variant="outline" size="sm" onclick={surrender}>기권</Button>
            {:else if result}
                <div class="space-y-2 rounded-lg border p-4">
                    <p class="text-base font-semibold">
                        {result.youWon ? '🎉 승리했습니다!' : '아쉽게 패했습니다.'}
                        <span class="text-muted-foreground text-sm font-normal">
                            ({reasonText[result.reason] ?? result.reason})
                        </span>
                    </p>
                    {#if myStats}
                        <p class="text-muted-foreground text-sm">
                            전적 {myStats.wins}승 {myStats.losses}패 {myStats.draws}무 · 점수 {myStats.rating}
                        </p>
                    {/if}
                    <Button size="sm" onclick={resetToIdle}>다시 하기</Button>
                </div>
            {/if}
        {/if}
    </Card.Content>
</Card.Root>
