<script lang="ts">
    /**
     * 장기 온라인 대전 (WebSocket) — 오목(omok-online)과 같은 골격.
     *
     * 서버: cmd/janggi-ws (angple-backend, internal/janggi_srv) — 행마 합법성·장군·
     * 외통 판정은 전부 서버가 한다. 이 컴포넌트는 from/to 좌표만 보내고 서버가
     * 확정한 국면(pieces)을 그린다. 클라이언트에 규칙 계산이 없다.
     *
     * ⛔ 참가비 1,000P — 큐 진입 전 동의 필수(오목과 동일 원칙).
     * 대기실 4종(대기현황·연습판·초대링크·랭킹)도 오목과 동일하게 제공한다.
     */
    import { authStore, authActions } from '$lib/stores/auth.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Card from '$lib/components/ui/card/index.js';
    import { onDestroy } from 'svelte';
    // 대기 중 연습판 — props 없는 독립 컴포넌트(로컬 AI)
    import JanggiGame from './janggi-game.svelte';

    const COLS = 9;
    const ROWS = 10;
    const CELL = 52;
    const PAD = 34;
    const W = PAD * 2 + (COLS - 1) * CELL;
    const H = PAD * 2 + (ROWS - 1) * CELL;

    // 서버 엔진과 동일 코드값 (internal/janggi)
    const TEAM_CHO = 1;
    const TEAM_HAN = 2;
    const KIND_TEXT: Record<number, [string, string]> = {
        1: ['楚', '漢'], // 궁
        2: ['車', '車'],
        3: ['象', '象'],
        4: ['馬', '馬'],
        5: ['士', '士'],
        6: ['包', '包'],
        7: ['卒', '兵']
    };
    function pieceRadius(kind: number): number {
        if (kind === 1) return 23;
        if (kind === 5 || kind === 7) return 15;
        return 19;
    }
    function fontSize(kind: number): number {
        if (kind === 1) return 26;
        if (kind === 5 || kind === 7) return 14;
        return 18;
    }

    interface Piece {
        kind: number;
        team: number;
        x: number;
        y: number;
        alive: boolean;
    }

    type Phase = 'idle' | 'connecting' | 'queued' | 'playing' | 'over';

    let phase = $state<Phase>('idle');
    let pieces = $state<Piece[]>([]);
    let myTeam = $state(0);
    let currentTeam = $state(TEAM_CHO);
    let roomId = $state('');
    let opponent = $state<{ nickname?: string; rating?: number } | null>(null);
    let message = $state('');
    let entryFee = $state(1000);
    let queuePosition = $state(0);
    let turnLeft = $state(0);
    let inCheck = $state(false);
    let result = $state<{ youWon: boolean; reason: string } | null>(null);
    let myStats = $state<{ wins: number; losses: number; draws: number; rating: number } | null>(
        null
    );
    let agreed = $state(false);
    let selected = $state<{ x: number; y: number } | null>(null);
    let socket: WebSocket | null = null;
    let turnTimer: ReturnType<typeof setInterval> | null = null;

    const isMyTurn = $derived(phase === 'playing' && currentTeam === myTeam);

    // ── 대기 현황·랭킹·연습판·초대 (오목 대기실 4종과 동일 구성) ──────────
    let lobbyWaiting = $state<number | null>(null);
    let ranking = $state<Array<{
        nickname: string;
        wins: number;
        losses: number;
        draws: number;
        rating: number;
    }> | null>(null);
    let showRanking = $state(false);
    let inviteFromUrl = $state<string | null>(null);
    let inviteCopied = $state(false);
    let practiceWhileWaiting = $state(false);

    async function fetchLobby() {
        try {
            const r = await fetch('/janggi-ws/lobby');
            if (r.ok) lobbyWaiting = (await r.json()).waiting ?? null;
        } catch {
            // 표시용 — 실패는 조용히
        }
    }

    async function toggleRanking() {
        showRanking = !showRanking;
        if (showRanking && ranking === null) {
            try {
                const r = await fetch('/janggi-ws/ranking');
                ranking = r.ok ? ((await r.json()).ranking ?? []) : [];
            } catch {
                ranking = [];
            }
        }
    }

    function makeInviteCode(): string {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const buf = new Uint8Array(10);
        crypto.getRandomValues(buf);
        return Array.from(buf, (b) => chars[b % chars.length]).join('');
    }

    async function createInviteAndWait() {
        const code = makeInviteCode();
        const url = `${location.origin}/games/janggi?invite=${code}`;
        try {
            await navigator.clipboard.writeText(url);
            inviteCopied = true;
            setTimeout(() => (inviteCopied = false), 4000);
        } catch {
            message = `링크 복사에 실패했습니다. 직접 전달해 주세요: ${url}`;
        }
        void connect('favorite', code);
    }

    // 폴링 10초 — 반응형 값을 읽지 않는 1회 설치형(재트리거 금지 원칙).
    $effect(() => {
        fetchLobby();
        const t = setInterval(fetchLobby, 10_000);
        const code = new URLSearchParams(location.search).get('invite');
        if (code && /^[a-zA-Z0-9]{4,32}$/.test(code)) inviteFromUrl = code;
        return () => clearInterval(t);
    });

    function wsUrl(token: string): string {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${proto}//${location.host}/janggi-ws/?token=${encodeURIComponent(token)}`;
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

    // ⛔ 동의 전에도 버튼은 살아 있다 — 누르면 이유를 말한다(오목 사고 교훈).
    function tryConnect(mode: 'random' | 'rating') {
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

        // SSR_STRIP_USER + user_basic fast-path 환경에선 토큰이 비어 있는 게 정상 —
        // WebSocket 은 헤더를 못 붙이므로 필요한 순간에 받아 온다(오목과 동일).
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
            case 'matching_status':
                if (msg.status === 'queued') {
                    phase = 'queued';
                    queuePosition = msg.position ?? 0;
                    if (typeof msg.entryFee === 'number') entryFee = msg.entryFee;
                } else if (msg.status === 'matched') {
                    opponent = msg.opponent ?? null;
                    roomId = msg.roomId ?? '';
                    practiceWhileWaiting = false;
                } else if (msg.status === 'error') {
                    message = msg.message ?? '매칭에 실패했습니다.';
                    phase = 'idle';
                    socket?.close();
                }
                break;
            case 'game_start':
                roomId = msg.roomId ?? roomId;
                myTeam = msg.playerTeam ?? 0;
                pieces = msg.gameState?.pieces ?? [];
                currentTeam = msg.gameState?.currentTeam ?? TEAM_CHO;
                inCheck = false;
                selected = null;
                lastMove = null;
                result = null;
                phase = 'playing';
                startTurnCountdown(msg.turnSeconds ?? 90);
                break;
            case 'move':
                if (msg.from && msg.to) {
                    lastMove = { fx: msg.from.x, fy: msg.from.y, tx: msg.to.x, ty: msg.to.y };
                }
                pieces = msg.pieces ?? pieces;
                currentTeam = msg.currentTeam ?? currentTeam;
                inCheck = msg.check === true;
                selected = null;
                if (msg.passed) {
                    message = '상대가 둘 수 있는 수가 없어 한 수 쉬었습니다.';
                } else {
                    message = '';
                }
                startTurnCountdown(90);
                break;
            case 'game_restored':
                roomId = msg.roomId ?? roomId;
                myTeam = msg.gameState?.playerTeam ?? myTeam;
                pieces = msg.gameState?.pieces ?? pieces;
                currentTeam = msg.gameState?.currentTeam ?? currentTeam;
                phase = 'playing';
                startTurnCountdown(90);
                break;
            case 'opponent_disconnected':
                message = msg.message ?? '상대방의 연결이 끊겼습니다.';
                break;
            case 'opponent_reconnected':
                message = '상대방이 다시 접속했습니다.';
                break;
            case 'game_over':
                phase = 'over';
                result = { youWon: msg.youWon === true, reason: msg.reason ?? '' };
                myStats = msg.stats ?? myStats;
                if (turnTimer) clearInterval(turnTimer);
                if (msg.message) message = msg.message;
                break;
            case 'matching_canceled':
                phase = 'idle';
                socket?.close();
                break;
            case 'error':
                message = msg.message ?? '오류가 발생했습니다.';
                break;
        }
    }

    function cancelQueue() {
        send('cancel_matching');
        practiceWhileWaiting = false;
    }

    function surrender() {
        if (confirm('기권하시겠습니까? 패배로 기록됩니다.')) {
            send('surrender', { roomId });
        }
    }

    // ── 착수: 내 말 선택 → 목적지 클릭. 합법성은 서버만 판정한다. ──────────
    function pieceAt(x: number, y: number): Piece | undefined {
        return pieces.find((p) => p.alive && p.x === x && p.y === y);
    }

    function clickPoint(x: number, y: number) {
        if (!isMyTurn) return;
        const target = pieceAt(x, y);
        if (selected) {
            if (target && target.team === myTeam) {
                selected = { x, y }; // 내 다른 말로 선택 변경
                return;
            }
            send('move', {
                roomId,
                fromX: selected.x,
                fromY: selected.y,
                toX: x,
                toY: y
            });
            // 낙관 갱신 없음 — 서버 확정(move 메시지)만 반영한다.
            return;
        }
        if (target && target.team === myTeam) selected = { x, y };
    }

    function reset() {
        socket?.close();
        socket = null;
        phase = 'idle';
        pieces = [];
        selected = null;
        message = '';
        result = null;
        inCheck = false;
    }

    onDestroy(() => {
        if (turnTimer) clearInterval(turnTimer);
        socket?.close();
    });

    let lastMove = $state<{ fx: number; fy: number; tx: number; ty: number } | null>(null);

    // 실물 장기알은 팔각형이다 — 반지름 r 팔각 꼭짓점(22.5° 오프셋, 평평한 변이 위로)
    function oct(cx: number, cy: number, r: number): string {
        const pts: string[] = [];
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i + Math.PI / 8;
            pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
        }
        return pts.join(' ');
    }

    // 전통 장기판의 귀점(포·졸 자리 교차 표시)
    const POINT_MARKS: Array<[number, number]> = [
        [1, 2],
        [7, 2],
        [0, 3],
        [2, 3],
        [4, 3],
        [6, 3],
        [8, 3],
        [1, 7],
        [7, 7],
        [0, 6],
        [2, 6],
        [4, 6],
        [6, 6],
        [8, 6]
    ];

    const px = (x: number) => PAD + x * CELL;
    const py = (y: number) => PAD + y * CELL;
</script>

<Card.Root>
    <Card.Header>
        <Card.Title class="flex flex-wrap items-center gap-2">
            온라인 대전
            {#if myStats}
                <span class="text-muted-foreground text-sm font-normal">
                    {myStats.wins}승 {myStats.losses}패 · {myStats.rating}
                </span>
            {/if}
            {#if phase === 'playing'}
                <Badge variant={myTeam === TEAM_CHO ? 'default' : 'secondary'}>
                    나 · {myTeam === TEAM_CHO ? '초(楚)' : '한(漢)'}
                </Badge>
                <Badge variant="outline">
                    {isMyTurn ? `내 차례 · ${turnLeft}초` : `상대 차례 · ${turnLeft}초`}
                </Badge>
                {#if inCheck}
                    <Badge variant="destructive">장군!</Badge>
                {/if}
            {/if}
        </Card.Title>
    </Card.Header>
    <Card.Content class="space-y-3">
        {#if message}
            <p class="text-sm text-amber-600 dark:text-amber-400">{message}</p>
        {/if}

        {#if phase === 'idle'}
            {#if inviteFromUrl}
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
                    <b>패배로 처리</b>됩니다. 한 수 제한시간은 <b>90초</b>입니다.
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
                <div class="rounded-lg border p-2">
                    <p class="text-muted-foreground mb-2 px-2 text-xs">
                        연습 대국입니다 — 상대가 매칭되면 이 판은 사라지고 실전이 시작됩니다.
                    </p>
                    <JanggiGame />
                </div>
            {/if}
        {/if}

        {#if phase === 'playing' || phase === 'over'}
            {#if opponent}
                <p class="text-muted-foreground text-sm">
                    상대: {opponent.nickname ?? '앙님'}
                    {#if opponent.rating}· {opponent.rating}점{/if}
                </p>
            {/if}

            <div class="overflow-x-auto">
                <svg
                    viewBox="0 0 {W} {H}"
                    class="mx-auto block max-w-full rounded-xl shadow-md"
                    style="max-width:{W}px"
                    role="img"
                    aria-label="장기판"
                >
                    <defs>
                        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0" stop-color="#e8c48c" />
                            <stop offset="0.5" stop-color="#dcb478" />
                            <stop offset="1" stop-color="#d0a465" />
                        </linearGradient>
                        <radialGradient id="pcho" cx="0.35" cy="0.3" r="1">
                            <stop offset="0" stop-color="#fdf6e3" />
                            <stop offset="1" stop-color="#e8d9b5" />
                        </radialGradient>
                        <radialGradient id="phan" cx="0.35" cy="0.3" r="1">
                            <stop offset="0" stop-color="#fdf2ec" />
                            <stop offset="1" stop-color="#ecd6c6" />
                        </radialGradient>
                    </defs>
                    <rect width={W} height={H} rx="12" fill="url(#wood)" />
                    <rect
                        x={PAD - 14}
                        y={PAD - 14}
                        width={W - (PAD - 14) * 2}
                        height={H - (PAD - 14) * 2}
                        fill="none"
                        stroke="#5c3d1e"
                        stroke-width="2.5"
                        rx="3"
                    />
                    <!-- 판 선 -->
                    {#each Array(ROWS) as _, r (r)}
                        <line
                            x1={px(0)}
                            y1={py(r)}
                            x2={px(COLS - 1)}
                            y2={py(r)}
                            stroke="#6b4a24"
                            stroke-width="1.1"
                        />
                    {/each}
                    {#each Array(COLS) as _, c (c)}
                        <line
                            x1={px(c)}
                            y1={py(0)}
                            x2={px(c)}
                            y2={py(ROWS - 1)}
                            stroke="#6b4a24"
                            stroke-width="1.1"
                        />
                    {/each}
                    <!-- 궁성 대각선 -->
                    <line
                        x1={px(3)}
                        y1={py(0)}
                        x2={px(5)}
                        y2={py(2)}
                        stroke="#6b4a24"
                        stroke-width="1.1"
                    />
                    <line
                        x1={px(5)}
                        y1={py(0)}
                        x2={px(3)}
                        y2={py(2)}
                        stroke="#6b4a24"
                        stroke-width="1.1"
                    />
                    <line
                        x1={px(3)}
                        y1={py(7)}
                        x2={px(5)}
                        y2={py(9)}
                        stroke="#6b4a24"
                        stroke-width="1.1"
                    />
                    <line
                        x1={px(5)}
                        y1={py(7)}
                        x2={px(3)}
                        y2={py(9)}
                        stroke="#6b4a24"
                        stroke-width="1.1"
                    />
                    <!-- 귀점 -->
                    {#each POINT_MARKS as [mx, my] (mx + '-' + my)}
                        <circle cx={px(mx)} cy={py(my)} r="2.6" fill="#6b4a24" opacity="0.55" />
                    {/each}

                    <!-- 마지막 수 표시 -->
                    {#if lastMove}
                        <circle
                            cx={px(lastMove.fx)}
                            cy={py(lastMove.fy)}
                            r="5"
                            fill="#2563eb"
                            opacity="0.35"
                        />
                        <circle
                            cx={px(lastMove.tx)}
                            cy={py(lastMove.ty)}
                            r={CELL / 2 - 5}
                            fill="none"
                            stroke="#2563eb"
                            stroke-width="2.5"
                            opacity="0.55"
                        />
                    {/if}

                    <!-- 클릭 판 -->
                    {#each Array(ROWS) as _, r (r)}
                        {#each Array(COLS) as _, c (c)}
                            <circle
                                cx={px(c)}
                                cy={py(r)}
                                r={CELL / 2 - 2}
                                fill="transparent"
                                style="cursor:{isMyTurn ? 'pointer' : 'default'}"
                                role="button"
                                tabindex="-1"
                                onclick={() => clickPoint(c, r)}
                            />
                        {/each}
                    {/each}

                    <!-- 선택 표시 -->
                    {#if selected}
                        <circle
                            cx={px(selected.x)}
                            cy={py(selected.y)}
                            r={CELL / 2 - 3}
                            fill="none"
                            stroke="#16a34a"
                            stroke-width="3"
                        />
                    {/if}

                    <!-- 기물 (팔각) -->
                    {#each pieces.filter((p) => p.alive) as p (p.team + '-' + p.kind + '-' + p.x + '-' + p.y)}
                        <g style="pointer-events:none">
                            <polygon
                                points={oct(px(p.x), py(p.y) + 1.5, pieceRadius(p.kind))}
                                fill="#00000022"
                            />
                            <polygon
                                points={oct(px(p.x), py(p.y), pieceRadius(p.kind))}
                                fill={p.team === TEAM_CHO ? 'url(#pcho)' : 'url(#phan)'}
                                stroke={p.team === TEAM_CHO ? '#14532d' : '#991b1b'}
                                stroke-width="2"
                            />
                            <text
                                x={px(p.x)}
                                y={py(p.y)}
                                text-anchor="middle"
                                dominant-baseline="central"
                                font-size={fontSize(p.kind)}
                                font-weight="800"
                                fill={p.team === TEAM_CHO ? '#14532d' : '#991b1b'}
                                style="text-shadow:0 1px 0 #ffffff88"
                            >
                                {KIND_TEXT[p.kind]?.[p.team === TEAM_CHO ? 0 : 1] ?? '?'}
                            </text>
                        </g>
                    {/each}
                </svg>
            </div>

            {#if phase === 'playing'}
                <div class="flex justify-end">
                    <Button variant="ghost" size="sm" onclick={surrender}>기권</Button>
                </div>
            {/if}

            {#if phase === 'over' && result}
                <div class="space-y-2 rounded-lg border p-4 text-center">
                    <p class="text-lg font-bold">
                        {result.youWon ? '🎉 승리!' : result.reason === 'draw' ? '무승부' : '패배'}
                    </p>
                    {#if myStats}
                        <p class="text-muted-foreground text-sm">
                            전적 {myStats.wins}승 {myStats.losses}패 {myStats.draws}무 · 점수 {myStats.rating}
                        </p>
                    {/if}
                    <Button size="sm" onclick={reset}>대기실로</Button>
                </div>
            {/if}
        {/if}
    </Card.Content>
</Card.Root>
