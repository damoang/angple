<script lang="ts">
    /**
     * 장기 온라인 대전 (WebSocket) — 오목(omok-online)과 같은 골격.
     *
     * 서버: cmd/janggi-ws (angple-backend, internal/janggi_srv) — 행마 합법성·장군·
     * 외통 판정은 전부 서버가 한다. 이 컴포넌트는 from/to 좌표만 보내고 서버가
     * 확정한 국면(pieces)을 그린다. 클라이언트 규칙 계산은 「이동 가능한 칸」 안내뿐이다
     * (보드 = janggi-board.svelte, AI 연습판과 같은 컴포넌트).
     * 먹은 말 줄·장군/멍군 알림·끝 이유 문구는 받은 국면·game_over.reason 으로 화면만 꾸민다.
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
    // 상차림 선택 화면은 AI 연습판과 같은 미리보기(janggi-setup-picker)를 쓴다.
    import JanggiGame from './janggi-game.svelte';
    import JanggiBoard from './janggi-board.svelte';
    import JanggiSetupPicker from './janggi-setup-picker.svelte';
    import JanggiCaptured from './janggi-captured.svelte';
    import {
        TEAM,
        isCheck,
        isSetup,
        legalTargets,
        type JanggiPiece,
        type Setup
    } from '$lib/games/janggi/rules';
    import { boardScore, fallbackOrder, nextCaptureOrder } from '$lib/games/janggi/captured';
    import { checkEvent, isCheckmate, otherTeam } from '$lib/games/janggi/check-events';
    import { endText, isScoreReason, type EndScores } from '$lib/games/janggi/end-reason';
    import { CheckFlash } from '$lib/games/janggi/flash.svelte';
    import {
        opponentSetup,
        parseSetupChoose,
        parseSetups,
        secondsLeft,
        setupText,
        teamDefaultSetup,
        type Setups
    } from '$lib/games/janggi/online-setup';

    // 서버 엔진과 동일 코드값 (internal/janggi)
    const TEAM_CHO = 1;

    type Piece = JanggiPiece;

    // setup = 매칭 후 상차림 선택 단계(신 서버만 — 구 서버는 바로 game_start)
    type Phase = 'idle' | 'connecting' | 'queued' | 'setup' | 'playing' | 'over';

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
    let result = $state<{ youWon: boolean; reason: string; scores: EndScores | null } | null>(null);
    let myStats = $state<{ wins: number; losses: number; draws: number; rating: number } | null>(
        null
    );
    let agreed = $state(false);
    let selected = $state<{ x: number; y: number } | null>(null);
    // 먹은 말 순서·둔 수(재접속하면 수는 모른다 → null)·직전 장군 받던 진영·장군/멍군 알림
    let captureOrder = $state<number[]>([]);
    let moveCount = $state<number | null>(0);
    let lastCheckTeam: number | null = null;
    const flash = new CheckFlash();
    let socket: WebSocket | null = null;
    let turnTimer: ReturnType<typeof setInterval> | null = null;

    // ── 상차림 선택 단계 ────────────────────────────────────────────────
    // AI 연습판(janggi-game)과 같은 저장 키 — 이름이 자기 시점이라 진영과 무관하게 재사용한다.
    const SETUP_KEY = 'angple_janggi_setup';
    let setupChoice = $state<Setup>(teamDefaultSetup(TEAM_CHO));
    let setupSent = $state(false);
    let setupLeft = $state(0);
    let opponentChosen = $state(false);
    let setupAnnounce = $state('');
    let setups = $state<Setups | null>(null);
    let setupDeadline = 0;
    let setupTimer: ReturnType<typeof setInterval> | null = null;

    const setupHint = $derived(
        '배치는 내 쪽에서 본 왼쪽부터입니다. 시간 안에 고르지 않으면 기본 배치(' +
            setupText(teamDefaultSetup(myTeam)) +
            ')로 시작합니다. 상대 상차림은 대국이 시작되면 공개됩니다.'
    );
    const opponentSetupLine = $derived.by(() => {
        const s = opponentSetup(setups, myTeam);
        return s ? `상대 상차림: ${setupText(s)}` : '';
    });

    function stopSetupTimer() {
        if (setupTimer) clearInterval(setupTimer);
        setupTimer = null;
    }

    function tickSetup() {
        const left = secondsLeft(setupDeadline, Date.now());
        if (left !== setupLeft && (left === 10 || left === 5)) {
            setupAnnounce = `상차림 선택 ${left}초 남았습니다.`;
        }
        setupLeft = left;
        if (left === 0) stopSetupTimer();
    }

    function savedSetup(team: number): Setup {
        try {
            const s = localStorage.getItem(SETUP_KEY);
            if (isSetup(s)) return s;
        } catch {
            // 저장소 차단 — 기본값
        }
        return teamDefaultSetup(team);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function enterSetup(msg: any) {
        const c = parseSetupChoose(msg);
        if (!c) return;
        const restoring = phase === 'setup' && roomId === c.roomId;
        roomId = c.roomId || roomId;
        if (c.playerTeam) myTeam = c.playerTeam;
        if (c.mySetup) {
            setupChoice = c.mySetup;
            setupSent = true;
        } else if (!restoring) {
            setupChoice = savedSetup(myTeam);
            setupSent = false;
        }
        if (!restoring) opponentChosen = false;
        setups = null;
        practiceWhileWaiting = false;
        phase = 'setup';
        setupAnnounce = setupSent
            ? '상차림 선택 완료 — 상대를 기다리는 중입니다.'
            : `상차림을 골라 주세요. ${Math.ceil(c.remainingMs / 1000)}초 남았습니다.`;
        stopSetupTimer();
        setupDeadline = Date.now() + c.remainingMs;
        tickSetup();
        if (setupLeft > 0) setupTimer = setInterval(tickSetup, 250);
    }

    function chooseOnlineSetup(s: Setup) {
        if (!setupSent) setupChoice = s;
    }

    function confirmSetup() {
        if (setupSent || phase !== 'setup' || setupLeft === 0 || !socket) return;
        setupSent = true;
        // 서버 수신 형식은 {type, data} 봉투 — 계약서의 평평한 필드도 같이 실어 둘 다 읽히게 한다.
        socket.send(
            JSON.stringify({
                type: 'setup_select',
                roomId,
                setup: setupChoice,
                data: { roomId, setup: setupChoice }
            })
        );
        setupAnnounce = '상차림 선택 완료 — 상대를 기다리는 중입니다.';
        try {
            localStorage.setItem(SETUP_KEY, setupChoice);
        } catch {
            // 무시
        }
    }

    const isMyTurn = $derived(phase === 'playing' && currentTeam === myTeam);

    // 끝 배너·결과 문구(이유 · 수 · 점수 판정 점수)
    const endInfo = $derived(
        result
            ? endText(result.reason, result.youWon, { moves: moveCount, scores: result.scores })
            : null
    );

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
            stopSetupTimer();
            message = '대전 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.';
            phase = 'idle';
        };
        socket.onclose = (ev) => {
            stopSetupTimer();
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
                    stopSetupTimer();
                    message = msg.message ?? '매칭에 실패했습니다.';
                    phase = 'idle';
                    socket?.close();
                }
                break;
            case 'setup_choose':
                enterSetup(msg);
                break;
            case 'setup_status':
                if (phase === 'setup') {
                    opponentChosen =
                        myTeam === TEAM_CHO ? msg.hanSelected === true : msg.choSelected === true;
                    if (opponentChosen) setupAnnounce = '상대가 상차림을 골랐습니다.';
                    // 재접속 등으로 mySetup 을 못 받았어도 서버가 선택됨이라 하면 잠근다.
                    const mine = myTeam === TEAM_CHO ? msg.choSelected : msg.hanSelected;
                    if (mine === true) setupSent = true;
                }
                break;
            case 'game_start':
                stopSetupTimer();
                // 구 서버는 setups 가 없다 — 그때는 표시만 생략하고 기존대로 진행
                setups = parseSetups(msg.setups ?? msg.gameState?.setups);
                roomId = msg.roomId ?? roomId;
                myTeam = msg.playerTeam ?? 0;
                pieces = msg.gameState?.pieces ?? [];
                currentTeam = msg.gameState?.currentTeam ?? TEAM_CHO;
                inCheck = false;
                selected = null;
                lastMove = null;
                result = null;
                captureOrder = fallbackOrder(pieces);
                moveCount = 0;
                lastCheckTeam = null;
                flash.clear();
                phase = 'playing';
                startTurnCountdown(msg.turnSeconds ?? 90);
                break;
            case 'move': {
                if (msg.from && msg.to) {
                    lastMove = { fx: msg.from.x, fy: msg.from.y, tx: msg.to.x, ty: msg.to.y };
                }
                const prev = pieces;
                pieces = msg.pieces ?? pieces;
                captureOrder = nextCaptureOrder(captureOrder, prev, pieces);
                if (moveCount !== null) moveCount++;
                currentTeam = msg.currentTeam ?? currentTeam;
                inCheck = msg.check === true;
                selected = null;
                // 장군·멍군 — 서버는 외통 수에 check:false 를 보내고 game_over 로 끝낸다.
                // 그 순간엔 알림 대신 끝 배너가 떠야 하므로 같은 규칙으로 외통을 미리 본다.
                const mover = moveTeam(msg);
                if (mover) {
                    const opp = otherTeam(mover);
                    const nowCheck = inCheck ? opp : null;
                    const mate = !inCheck && isCheckmate(pieces, opp);
                    const ev = checkEvent(lastCheckTeam, mover, nowCheck, mate);
                    lastCheckTeam = nowCheck;
                    if (ev) flash.show(ev);
                } else {
                    lastCheckTeam = null;
                }
                if (msg.passed) {
                    message = '상대가 둘 수 있는 수가 없어 한 수 쉬었습니다.';
                } else {
                    message = '';
                }
                startTurnCountdown(90);
                break;
            }
            case 'game_restored':
                stopSetupTimer();
                setups = parseSetups(msg.gameState?.setups ?? msg.setups) ?? setups;
                roomId = msg.roomId ?? roomId;
                myTeam = msg.gameState?.playerTeam ?? myTeam;
                pieces = msg.gameState?.pieces ?? pieces;
                currentTeam = msg.gameState?.currentTeam ?? currentTeam;
                // 복원은 직전 국면이 없다 — 먹은 말은 점수 큰 순, 둔 수는 모름
                captureOrder = fallbackOrder(pieces);
                moveCount = null;
                inCheck = isCheck(pieces, currentTeam);
                lastCheckTeam = inCheck ? currentTeam : null;
                flash.clear();
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
                flash.clear();
                result = {
                    youWon: msg.youWon === true,
                    reason: msg.reason ?? '',
                    // 점수 판정 — 마지막 국면으로 서버와 같은 점수(한 덤 포함)를 다시 센다
                    scores: isScoreReason(msg.reason ?? '')
                        ? { cho: boardScore(pieces, TEAM.CHO), han: boardScore(pieces, TEAM.HAN) }
                        : null
                };
                myStats = msg.stats ?? myStats;
                if (turnTimer) clearInterval(turnTimer);
                stopSetupTimer();
                if (msg.message) message = msg.message;
                break;
            case 'matching_canceled':
                stopSetupTimer();
                phase = 'idle';
                socket?.close();
                break;
            case 'error':
                message = msg.message ?? '오류가 발생했습니다.';
                break;
        }
    }

    // 이번 수를 둔 진영 — 서버가 team 을 싣는다. 없으면 도착 칸의 말로 본다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function moveTeam(msg: any): number {
        if (msg.team === TEAM.CHO || msg.team === TEAM.HAN) return msg.team;
        if (!msg.to) return 0;
        const p = pieces.find((q) => q.alive && q.x === msg.to.x && q.y === msg.to.y);
        return p ? p.team : 0;
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
        stopSetupTimer();
        setups = null;
        setupSent = false;
        opponentChosen = false;
        socket?.close();
        socket = null;
        phase = 'idle';
        pieces = [];
        selected = null;
        message = '';
        result = null;
        inCheck = false;
        captureOrder = [];
        moveCount = 0;
        lastCheckTeam = null;
        flash.clear();
    }

    onDestroy(() => {
        flash.clear();
        if (turnTimer) clearInterval(turnTimer);
        stopSetupTimer();
        socket?.close();
    });

    let lastMove = $state<{ fx: number; fy: number; tx: number; ty: number } | null>(null);

    // 보드 표시용 — 규칙 판정은 서버가 하고, 여기서는 이동 가능한 칸 안내만 계산한다.
    const boardLastMove = $derived(
        lastMove
            ? { from: { x: lastMove.fx, y: lastMove.fy }, to: { x: lastMove.tx, y: lastMove.ty } }
            : null
    );
    const boardTargets = $derived.by(() => {
        if (!selected || !isMyTurn) return [];
        const sel = selected;
        const idx = pieces.findIndex((p) => p.alive && p.x === sel.x && p.y === sel.y);
        return idx >= 0 ? legalTargets(pieces, idx) : [];
    });
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
        {:else if phase === 'setup'}
            <section class="space-y-3 rounded-lg border p-4" aria-labelledby="janggi-setup-title">
                {#if opponent}
                    <p class="text-muted-foreground text-sm">
                        상대: {opponent.nickname ?? '앙님'}
                        {#if opponent.rating}· {opponent.rating}점{/if}
                    </p>
                {/if}
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 id="janggi-setup-title" class="text-sm font-semibold">
                        상차림을 골라 주세요
                    </h3>
                    <Badge
                        variant={setupLeft <= 5 && !setupSent ? 'destructive' : 'outline'}
                        class="tabular-nums"
                    >
                        남은 시간 {setupLeft}초
                    </Badge>
                </div>
                <JanggiSetupPicker
                    value={setupChoice}
                    team={myTeam || TEAM_CHO}
                    legend="내 상차림 · {myTeam === TEAM_CHO ? '초(楚)' : '한(漢)'}"
                    disabled={setupSent || setupLeft === 0}
                    onSelect={chooseOnlineSetup}
                />
                <p class="text-muted-foreground text-xs">{setupHint}</p>
                {#if setupSent}
                    <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        ✔ {setupText(setupChoice)} 선택 완료 — 상대 기다리는 중
                    </p>
                {:else if setupLeft === 0}
                    <p class="text-muted-foreground text-sm">
                        시간이 끝났습니다 — 곧 기본 배치로 대국이 시작됩니다.
                    </p>
                {:else}
                    <Button class="w-full" onclick={confirmSetup}>
                        {setupText(setupChoice)}로 선택
                    </Button>
                {/if}
                <p class="text-muted-foreground text-xs">
                    상대: {opponentChosen ? '✔ 선택 완료' : '고르는 중…'}
                </p>
                <p class="sr-only" aria-live="polite">{setupAnnounce}</p>
            </section>
        {/if}

        {#if phase === 'playing' || phase === 'over'}
            {#if opponent}
                <p class="text-muted-foreground text-sm">
                    상대: {opponent.nickname ?? '앙님'}
                    {#if opponent.rating}· {opponent.rating}점{/if}
                </p>
            {/if}
            {#if opponentSetupLine}
                <p class="text-muted-foreground text-xs">{opponentSetupLine}</p>
            {/if}

            <p class="sr-only" aria-live="polite">{flash.current?.text ?? ''}</p>
            <div class="flex w-full flex-col items-center gap-1.5">
                <!-- 판은 뒤집지 않는다: 위 = 한 자리(한이 잡은 말), 아래 = 초 자리(초가 잡은 말) -->
                <JanggiCaptured {pieces} order={captureOrder} capturer={TEAM.HAN} />
                <JanggiBoard
                    {pieces}
                    {selected}
                    targets={boardTargets}
                    lastMove={boardLastMove}
                    checkTeam={inCheck ? currentTeam : null}
                    flash={flash.current}
                    banner={endInfo ? { text: endInfo.banner, tone: endInfo.tone } : null}
                    interactive={isMyTurn}
                    onPointClick={clickPoint}
                    label="장기판 — 온라인 대전"
                />
                <JanggiCaptured {pieces} order={captureOrder} capturer={TEAM.CHO} />
            </div>

            {#if phase === 'playing'}
                <div class="flex justify-end">
                    <Button variant="ghost" size="sm" onclick={surrender}>기권</Button>
                </div>
            {/if}

            {#if phase === 'over' && result && endInfo}
                <div class="space-y-2 rounded-lg border p-4 text-center">
                    <p class="text-lg font-bold">{endInfo.banner}</p>
                    <p class="text-muted-foreground text-sm">{endInfo.detail}</p>
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
