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
    import { authStore, authActions } from '$lib/stores/auth.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import { onDestroy } from 'svelte';
    // ② 대기 중 연습판 — props 없는 독립 컴포넌트라 그대로 끼운다
    import OmokGame from './omok-game.svelte';

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
    // ── 대기 현황·랭킹 (be#629 공개 API — 인증 불요) ──────────────────────
    // 유동성 핵심: "지금 누가 기다리고 있다"를 접속 전에 보여줘야 두 번째 사람이
    // 버튼을 누른다. 8/7 첫 대국 전까지 전원이 각자 혼자 대기하다 이탈했다.
    let lobbyWaiting = $state<number | null>(null);
    let ranking = $state<Array<{
        nickname: string;
        wins: number;
        losses: number;
        draws: number;
        rating: number;
    }> | null>(null);
    let showRanking = $state(false);
    // ③ 초대 대국 — 내가 만든 코드(링크 복사용) / URL 로 받은 코드(입장용)
    let inviteFromUrl = $state<string | null>(null);
    let inviteCopied = $state(false);
    // ② 대기 중 AI 연습판 토글
    let practiceWhileWaiting = $state(false);

    function makeInviteCode(): string {
        // 영숫자 10자 — 서버가 형식(4~32자 영숫자)만 검증한다
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const buf = new Uint8Array(10);
        crypto.getRandomValues(buf);
        return Array.from(buf, (b) => chars[b % chars.length]).join('');
    }

    async function createInviteAndWait() {
        const code = makeInviteCode();
        const url = `${location.origin}/games/omok?invite=${code}`;
        try {
            await navigator.clipboard.writeText(url);
            inviteCopied = true;
            setTimeout(() => (inviteCopied = false), 4000);
        } catch {
            // 클립보드 실패(권한 등) — 링크를 메시지로 보여준다
            message = `링크 복사에 실패했습니다. 직접 전달해 주세요: ${url}`;
        }
        void connect('favorite', code);
    }

    async function fetchLobby() {
        try {
            const r = await fetch('/omok-ws/lobby');
            if (r.ok) lobbyWaiting = (await r.json()).waiting ?? null;
        } catch {
            // 표시용 정보 — 실패는 조용히 (다음 폴링에서 회복)
        }
    }

    async function toggleRanking() {
        showRanking = !showRanking;
        if (showRanking && ranking === null) {
            try {
                const r = await fetch('/omok-ws/ranking');
                ranking = r.ok ? ((await r.json()).ranking ?? []) : [];
            } catch {
                ranking = [];
            }
        }
    }

    // 폴링 10초 — 서버 쪽 5초 캐시가 있어 부담 없다.
    // ⛔ 이 effect 는 반응형 값을 읽지 않는다(1회 설치) — 읽고+쓰기 재트리거 금지 원칙.
    $effect(() => {
        fetchLobby();
        const t = setInterval(fetchLobby, 10_000);
        // ③ 초대 링크로 들어온 경우 — 클라이언트 전용이라 location 을 바로 읽는다
        const code = new URLSearchParams(location.search).get('invite');
        if (code && /^[a-zA-Z0-9]{4,32}$/.test(code)) inviteFromUrl = code;
        return () => clearInterval(t);
    });

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

    function wsUrl(token: string): string {
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
        // 유료 모드 전용 게이트 — 초대 대국(무료)은 createInviteAndWait/joinInvite 로 간다
        if (!agreed) {
            message = '참가비 안내를 확인하신 뒤 아래 체크박스를 눌러 주세요.';
            return;
        }
        void connect(mode);
    }

    let pendingInvite: string | null = null;

    async function connect(mode: 'random' | 'rating' | 'favorite', invite?: string) {
        pendingInvite = invite ?? null;
        if (!authStore.isAuthenticated) {
            message = '로그인 후 이용할 수 있습니다.';
            return;
        }
        phase = 'connecting';
        message = '';

        // 로그인 상태라도 클라이언트에 토큰이 없는 정상 경로가 있다(운영 기본값인
        // SSR_STRIP_USER + user_basic 쿠키 fast-path). WebSocket 은 헤더를 못 붙여
        // 토큰을 쿼리로 넘겨야 하므로, 여기서 필요한 순간에 받아 온다.
        const token = await authActions.ensureAccessToken();
        if (!token) {
            message = '로그인 정보를 확인하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.';
            phase = 'idle';
            return;
        }

        try {
            socket = new WebSocket(wsUrl(token));
        } catch {
            message = '대전 서버 주소에 연결할 수 없습니다.';
            phase = 'idle';
            return;
        }

        socket.onopen = () =>
            send('join_matching_queue', pendingInvite ? { mode, invite: pendingInvite } : { mode });
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
            {#if inviteFromUrl}
                <!-- ③ 초대 링크로 진입 — 무료 대국이라 참가비 동의 없이 바로 입장한다.
                     이탈=패배 규칙만 알린다. -->
                <div
                    class="space-y-2 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/5 p-4"
                >
                    <p class="text-sm font-medium">💌 초대받은 대국이 있습니다 (참가비 없음)</p>
                    <p class="text-muted-foreground text-xs">
                        초대한 앙님이 기다리고 있어야 시작됩니다. 대국 중 자리를 비우거나 창을
                        닫으면 패배로 처리됩니다.
                    </p>
                    <Button size="sm" onclick={() => connect('favorite', inviteFromUrl!)}>
                        초대 대국 입장
                    </Button>
                </div>
            {/if}
            <div class="space-y-3 rounded-lg border p-4">
                {#if lobbyWaiting !== null && lobbyWaiting > 0}
                    <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        🟢 지금 {lobbyWaiting}명이 상대를 기다리고 있습니다 — 입장하시면 바로
                        매칭됩니다.
                    </p>
                {:else if lobbyWaiting === 0}
                    <p class="text-muted-foreground text-xs">
                        지금 대기 중인 앙님은 없습니다. 먼저 기다리시면 다음 접속자와 바로
                        매칭됩니다.
                    </p>
                {/if}
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
                <div class="border-t pt-3">
                    <div class="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" size="sm" onclick={createInviteAndWait}>
                            👥 친구와 두기 (무료)
                        </Button>
                        {#if inviteCopied}
                            <span class="text-xs text-emerald-600 dark:text-emerald-400">
                                초대 링크를 복사했습니다 — 친구에게 보내 주세요!
                            </span>
                        {:else}
                            <span class="text-muted-foreground text-xs">
                                초대 링크가 복사되고, 친구가 열 때까지 기다립니다.
                            </span>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- 랭킹 (be#629 — 닉네임·전적·점수만, mb_id 비노출) -->
            <div class="space-y-2">
                <Button variant="ghost" size="sm" onclick={toggleRanking}>
                    🏆 {showRanking ? '랭킹 접기' : '랭킹 보기'}
                </Button>
                {#if showRanking}
                    {#if ranking === null}
                        <p class="text-muted-foreground text-xs">불러오는 중…</p>
                    {:else if ranking.length === 0}
                        <p class="text-muted-foreground text-xs">
                            아직 전적이 있는 앙님이 없습니다. 첫 주인공이 되어 보세요!
                        </p>
                    {:else}
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="text-muted-foreground border-b text-left text-xs">
                                        <th class="py-1.5 pr-2">순위</th>
                                        <th class="py-1.5 pr-2">앙님</th>
                                        <th class="py-1.5 pr-2 text-right">전적</th>
                                        <th class="py-1.5 text-right">점수</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each ranking as row, i (row.nickname + i)}
                                        <tr class="border-b border-dashed last:border-0">
                                            <td class="py-1.5 pr-2">
                                                {i === 0
                                                    ? '🥇'
                                                    : i === 1
                                                      ? '🥈'
                                                      : i === 2
                                                        ? '🥉'
                                                        : i + 1}
                                            </td>
                                            <td class="max-w-[10rem] truncate py-1.5 pr-2">
                                                {row.nickname}
                                            </td>
                                            <td class="whitespace-nowrap py-1.5 pr-2 text-right">
                                                {row.wins}승 {row.losses}패{row.draws
                                                    ? ` ${row.draws}무`
                                                    : ''}
                                            </td>
                                            <td class="py-1.5 text-right font-medium"
                                                >{row.rating}</td
                                            >
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                {/if}
            </div>
        {:else if phase === 'connecting'}
            <p class="text-muted-foreground text-sm">대전 서버에 연결 중…</p>
        {:else if phase === 'queued'}
            <div class="space-y-2 rounded-lg border p-4">
                <p class="text-sm">상대를 찾고 있습니다… (대기 {queuePosition}번째)</p>
                <p class="text-muted-foreground text-xs">
                    매칭이 되는 순간 참가비가 차감됩니다. 아직 차감되지 않았습니다.
                </p>
                <div class="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onclick={cancelQueue}>취소</Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() => (practiceWhileWaiting = !practiceWhileWaiting)}
                    >
                        {practiceWhileWaiting ? '연습판 접기' : '🎯 기다리는 동안 AI와 연습'}
                    </Button>
                </div>
            </div>
            {#if practiceWhileWaiting}
                <!-- ② 대기 중 연습판 — 매칭되면 phase 가 playing 으로 바뀌며 자동으로 사라진다.
                     연습 국면은 저장하지 않는다(연습일 뿐, 이월 기대를 만들지 않는다). -->
                <div class="rounded-lg border p-2">
                    <p class="text-muted-foreground mb-2 px-2 text-xs">
                        연습 대국입니다 — 상대가 매칭되면 이 판은 사라지고 실전이 시작됩니다.
                    </p>
                    <OmokGame />
                </div>
            {/if}
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
