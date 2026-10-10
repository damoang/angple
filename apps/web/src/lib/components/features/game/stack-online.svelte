<script lang="ts">
    /**
     * 앙쌓기 온라인 대전 (WebSocket /stack-ws/).
     *
     * 각자 자기 엔진을 돌리고, 서버는 시드·매칭·방해 줄·판정·시간만 맡는다.
     * 조각이 굳을 때만 lock 을 보내고, 서버가 보낸 garbage_apply 를 engine.addGarbage 로 넣는다.
     * 메시지 이름·필드는 $lib/games/stack/versus.ts 의 타입 그대로다.
     *
     * ⛔ 무작위 매칭은 참가비 1,000P — 큐에 들어가기 전에 반드시 확인을 받는다.
     *    재대결도 판마다 다시 차감되므로 버튼 옆에 늘 안내한다. 초대 대전은 무료.
     * ⛔ 대전 중에는 일시정지가 없다. 페이지 탭을 옮겨도 이 컴포넌트는 숨겨질 뿐 연결·판은 유지된다.
     */
    import { untrack } from 'svelte';
    import {
        COLS,
        ROWS,
        IN_LEFT,
        IN_RIGHT,
        IN_CW,
        IN_CCW,
        IN_SOFT,
        IN_HARD
    } from '$lib/games/stack/engine.js';
    import {
        GARBAGE_PENDING_MAX,
        RULES,
        RULE_IDS,
        isRuleId,
        type ClientMessage,
        type MatchMode,
        type OpponentInfo,
        type PlayerStats,
        type RuleDef,
        type RuleId,
        type ServerMessage
    } from '$lib/games/stack/versus.js';
    import {
        createVersusPlayer,
        remainingSeconds,
        versusGarbage,
        versusTick,
        type VersusPlayer
    } from '$lib/games/stack/versus-play.js';
    import { drawBoard, drawNext } from '$lib/games/stack/render.js';
    import { STACK_API_BASE } from '$lib/games/stack/solo-record.js';
    import { getStackToken } from '$lib/games/stack/auth-token.js';
    import { createLoop } from '$lib/games/shell/loop.js';
    import { bindKeys, createHeldInput } from '$lib/games/shell/input.js';
    import { fitCanvas, observeSize } from '$lib/games/shell/canvas.js';

    /** 서버가 connected 를 보내기 전에 보여 줄 참가비 */
    const DEFAULT_ENTRY_FEE = 1000;
    /** 로비(대기 인원) 폴링 간격 */
    const LOBBY_POLL_MS = 15_000;
    /** 끊겼을 때 다시 연결을 시도하는 간격 — 합이 서버 유예(15초)보다 짧다 */
    const RETRY_MS = [500, 1500, 3000, 5000];

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

    const REASON_TEXT: Record<string, string> = {
        topout: '판이 넘침',
        goal: '목표 줄 달성',
        time: '시간 종료',
        resign: '기권',
        inactivity: '자리 비움',
        disconnect: '연결 끊김',
        cheat: '비정상 입력',
        draw: '무승부'
    };

    type Phase = 'idle' | 'connecting' | 'queued' | 'matched' | 'countdown' | 'playing' | 'over';
    type Intent =
        | { kind: 'join'; mode: MatchMode; rule: RuleId; invite?: string }
        | { kind: 'reconnect' }
        | { kind: 'surrender' };
    type GameOverData = Extract<ServerMessage, { type: 'game_over' }>['data'];

    let boardEl: HTMLCanvasElement;
    let nextEl: HTMLCanvasElement;
    let oppEl: HTMLCanvasElement;

    let phase = $state<Phase>('idle');
    let rule = $state<RuleId>('attack');
    let message = $state('');
    let announce = $state('');
    let entryFee = $state(DEFAULT_ENTRY_FEE);
    let myStats = $state<Partial<Record<RuleId, PlayerStats>>>({});
    let lobby = $state<Partial<Record<RuleId, number>> | null>(null);
    /** 무작위 매칭 참가비 확인 단계 */
    let confirmFee = $state(false);
    let inviteFromUrl = $state<{ code: string; rule: RuleId } | null>(null);
    let inviteLink = $state('');
    let inviteCopied = $state(false);
    let queueMode = $state<MatchMode>('random');
    let queuePosition = $state(0);
    let opponent = $state<OpponentInfo | null>(null);
    let feeCharged = $state(0);
    let readyLeft = $state(0);
    let readySent = $state(false);
    let countdown = $state(0);
    let activeRule = $state<RuleDef>(RULES.attack);
    let score = $state(0);
    let lines = $state(0);
    let level = $state(1);
    let pending = $state(0);
    let timeLeft = $state(0);
    let oppLines = $state(0);
    let oppScore = $state(0);
    let oppPending = $state(0);
    let oppAway = $state<number | null>(null);
    let toppedOut = $state(false);
    let reconnecting = $state(false);
    let result = $state<GameOverData | null>(null);
    let rematchState = $state<'none' | 'sent' | 'closed'>('none');
    let rematchOffer = $state<{ feeNotice: string; fee: number } | null>(null);
    let rematchLeft = $state(0);
    /** 다른 창·새로고침 전 대전이 남아 있어 줄을 설 수 없음 */
    let blockedInGame = $state(false);

    // 반응형이 아닌 상태
    let socket: WebSocket | null = null;
    let intent: Intent | null = null;
    let sessionId = '';
    let roomId = '';
    let player: VersusPlayer | null = null;
    let timeLimitMs = 0;
    let oppBoard = '';
    let dirty = true;
    let oppDirty = true;
    /** 연결이 끊겨 엔진을 멈춘 상태 */
    let frozen = false;
    let retry = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let secTimer: ReturnType<typeof setInterval> | null = null;
    let lobbyAt = 0;
    let destroyed = false;
    let leftoverTimer: ReturnType<typeof setTimeout> | undefined;

    /**
     * active=false 면 다른 탭이 보이는 중 — 키 입력을 받지 않는다(연결·판은 그대로).
     * busy 는 매칭 대기·준비·대전 중인지(페이지가 탭을 떠나기 전에 확인을 받는 데 쓴다).
     */
    let { active = true, busy = $bindable(false) }: { active?: boolean; busy?: boolean } = $props();

    $effect(() => {
        busy =
            phase === 'connecting' ||
            phase === 'queued' ||
            phase === 'matched' ||
            phase === 'countdown' ||
            phase === 'playing';
    });

    const input = createHeldInput({ repeat: IN_LEFT | IN_RIGHT, hold: IN_SOFT });
    const loop = createLoop(stepGame, render);

    const inGame = $derived(phase === 'countdown' || phase === 'playing' || phase === 'over');
    const goal = $derived(activeRule.goalLines);
    const ruleStats = $derived(myStats[rule]);

    /* ── 서버 연결 ── */

    function wsUrl(token: string): string {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        // 브라우저 WebSocket 은 헤더를 못 붙여서 토큰을 쿼리로 전달한다
        return `${proto}//${location.host}${STACK_API_BASE}/?token=${encodeURIComponent(token)}`;
    }

    function send(m: ClientMessage) {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
    }

    function sendAll(list: ClientMessage[]) {
        for (const m of list) send(m);
    }

    async function openSocket(next: Intent, fresh = false) {
        intent = next;
        const token = await getStackToken(fresh);
        if (destroyed || intent !== next) return;
        if (!token) {
            if (next.kind === 'reconnect') return scheduleReconnect();
            message = '로그인 정보를 확인하지 못했습니다. 새로고침한 뒤 다시 시도해 주세요.';
            phase = 'idle';
            return;
        }
        let ws: WebSocket;
        try {
            ws = new WebSocket(wsUrl(token));
        } catch {
            if (next.kind === 'reconnect') return scheduleReconnect();
            message = '대전 서버 주소에 연결할 수 없습니다.';
            phase = 'idle';
            return;
        }
        socket = ws;
        ws.onmessage = (ev) => {
            if (socket !== ws) return;
            let msg: ServerMessage;
            try {
                msg = JSON.parse(ev.data);
            } catch {
                return;
            }
            if (msg && typeof msg.type === 'string') handleMessage(msg);
        };
        ws.onclose = (ev) => {
            if (socket !== ws) return;
            socket = null;
            onSocketClosed(ev);
        };
    }

    /** 내가 닫는 연결 — onclose 처리를 타지 않는다 */
    function closeSocket() {
        const ws = socket;
        socket = null;
        intent = null;
        clearTimeout(retryTimer);
        if (ws) {
            ws.onclose = null;
            ws.onmessage = null;
            ws.close();
        }
    }

    function onSocketClosed(ev: CloseEvent) {
        if (destroyed) return;
        if (phase === 'matched' || phase === 'countdown' || phase === 'playing') {
            // 판은 서버에 남아 있다(유예 15초) — 엔진을 멈추고 다시 붙는다
            frozen = true;
            loop.stop();
            input.clear();
            reconnecting = true;
            message = '연결이 끊겨 다시 연결하는 중입니다…';
            scheduleReconnect();
            return;
        }
        if (phase === 'over') {
            rematchState = 'closed';
            rematchOffer = null;
            message = '대전 서버와 연결이 끊겨 재대결을 할 수 없습니다.';
            return;
        }
        if (phase === 'connecting' && !message) {
            message =
                ev.code === 1006
                    ? '대전 서버에 연결하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.'
                    : `연결이 종료되었습니다. (코드 ${ev.code})`;
        } else if (phase === 'queued') {
            message = '대전 서버와 연결이 끊겨 대기가 취소되었습니다.';
        }
        phase = 'idle';
    }

    function scheduleReconnect() {
        if (destroyed) return;
        if (retry >= RETRY_MS.length) {
            reconnecting = false;
            frozen = false;
            player = null;
            phase = 'idle';
            message = '연결을 되살리지 못했습니다. 이 대전은 연결 끊김으로 처리될 수 있습니다.';
            return;
        }
        const wait = RETRY_MS[retry++];
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => void openSocket({ kind: 'reconnect' }, true), wait);
    }

    /* ── 버튼 ── */

    function joinRandom() {
        closeSocket();
        confirmFee = false;
        message = '';
        blockedInGame = false;
        queueMode = 'random';
        phase = 'connecting';
        void openSocket({ kind: 'join', mode: 'random', rule });
    }

    function makeInviteCode(): string {
        // 영숫자 10자 — 서버는 4~32자 영숫자만 받는다
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const buf = new Uint8Array(10);
        crypto.getRandomValues(buf);
        return Array.from(buf, (b) => chars[b % chars.length]).join('');
    }

    async function createInvite() {
        const code = makeInviteCode();
        inviteLink = `${location.origin}/games/stack?invite=${code}&rule=${rule}`;
        try {
            await navigator.clipboard.writeText(inviteLink);
            inviteCopied = true;
        } catch {
            inviteCopied = false;
        }
        joinInvite(code, rule);
    }

    function joinInvite(code: string, inviteRule: RuleId) {
        closeSocket();
        confirmFee = false;
        message = '';
        blockedInGame = false;
        queueMode = 'favorite';
        rule = inviteRule;
        phase = 'connecting';
        void openSocket({ kind: 'join', mode: 'favorite', rule: inviteRule, invite: code });
    }

    function cancelQueue() {
        send({ type: 'cancel_matching', data: {} });
        closeSocket();
        phase = 'idle';
        inviteLink = '';
    }

    function sendReady() {
        if (!roomId || readySent) return;
        readySent = true;
        send({ type: 'ready', data: { roomId } });
    }

    /** 이 화면에서 이어 할 수 없는 남은 대전을 기권한다 — 연결이 끊겨 있으면 다시 붙어서 보낸다 */
    function surrenderLeftover() {
        if (!confirm('남은 대전을 기권하시겠습니까? 패배로 기록됩니다.')) return;
        message = '남은 대전 기권을 요청하는 중입니다…';
        if (socket && socket.readyState === WebSocket.OPEN) {
            send({ type: 'surrender', data: {} });
        } else {
            void openSocket({ kind: 'surrender' });
        }
        clearTimeout(leftoverTimer);
        leftoverTimer = setTimeout(() => {
            if (!blockedInGame) return;
            // 서버에 남은 대전이 없었다 (그사이 끝났음)
            blockedInGame = false;
            message = '남은 대전을 찾지 못했습니다. 이제 새로 시작할 수 있습니다.';
            closeSocket();
        }, 6000);
    }

    function surrender() {
        if (!confirm('기권하시겠습니까? 패배로 기록되며 참가비는 돌려받지 못합니다.')) return;
        send({ type: 'surrender', data: {} });
    }

    function requestRematch() {
        rematchState = 'sent';
        rematchOffer = null;
        send({ type: 'rematch', data: {} });
    }

    function leaveResult() {
        if (rematchState !== 'closed') send({ type: 'rematch_decline', data: {} });
        closeSocket();
        resetGame();
        phase = 'idle';
        message = '';
    }

    function resetGame() {
        loop.stop();
        input.clear();
        player = null;
        frozen = false;
        result = null;
        opponent = null;
        rematchState = 'none';
        rematchOffer = null;
        rematchLeft = 0;
        toppedOut = false;
        reconnecting = false;
        retry = 0;
        oppAway = null;
        roomId = '';
        inviteLink = '';
    }

    /* ── 서버 메시지 ── */

    function handleMessage(msg: ServerMessage) {
        switch (msg.type) {
            case 'connected': {
                const prev = sessionId;
                sessionId = msg.data.sessionId;
                entryFee = msg.data.entryFee ?? DEFAULT_ENTRY_FEE;
                myStats = msg.data.stats ?? {};
                const next = intent;
                if (next?.kind === 'join') {
                    send({
                        type: 'join_matching_queue',
                        data: next.invite
                            ? { mode: next.mode, rule: next.rule, invite: next.invite }
                            : { mode: next.mode, rule: next.rule }
                    });
                } else if (next?.kind === 'surrender') {
                    send({ type: 'surrender', data: {} });
                } else if (next?.kind === 'reconnect') {
                    send({ type: 'reconnect', data: { sessionId: prev || sessionId } });
                }
                break;
            }
            case 'matching_status': {
                const d = msg.data;
                if (d.status === 'waiting') {
                    phase = 'queued';
                    queuePosition = d.position ?? 0;
                    if (d.mode) queueMode = d.mode;
                } else if (d.status === 'matched') {
                    // 재대결은 둘 다 방금 버튼을 눌렀으니 바로 준비한다
                    const rematch = phase === 'over' && rematchState === 'sent';
                    resetGame();
                    roomId = d.roomId ?? '';
                    opponent = d.opponent ?? null;
                    feeCharged = d.entryFeeCharged ?? 0;
                    if (isRuleId(d.rule)) rule = d.rule;
                    readySent = false;
                    readyLeft = Math.ceil((d.readyMs ?? 10_000) / 1000);
                    phase = 'matched';
                    announce = `상대 ${opponent?.nickname ?? ''} 님과 매칭되었습니다. 준비를 눌러 주세요.`;
                    startSecTimer();
                    if (rematch) sendReady();
                } else {
                    message = d.message ?? '매칭에 실패했습니다.';
                    resetGame();
                    phase = 'idle';
                    if (d.code === 'already_in_game') {
                        // 다른 창이나 새로고침 전에 하던 대전 — 기권할 수 있게 연결은 남긴다
                        blockedInGame = true;
                    } else {
                        closeSocket();
                    }
                }
                break;
            }
            case 'game_start': {
                const d = msg.data;
                const spec =
                    d.ruleSpec && typeof d.ruleSpec.timeLimitSec === 'number'
                        ? d.ruleSpec
                        : isRuleId(d.rule)
                          ? RULES[d.rule]
                          : RULES.attack;
                activeRule = spec;
                roomId = d.roomId;
                player = createVersusPlayer(d.seed, spec);
                feeCharged = d.entryFeeCharged ?? feeCharged;
                timeLimitMs = spec.timeLimitSec * 1000;
                timeLeft = spec.timeLimitSec;
                score = 0;
                lines = 0;
                level = 1;
                pending = 0;
                oppLines = 0;
                oppScore = 0;
                oppPending = 0;
                oppBoard = '';
                toppedOut = false;
                frozen = false;
                readyLeft = 0;
                countdown = Math.max(1, Math.ceil((d.countdownMs ?? 3000) / 1000));
                phase = 'countdown';
                announce = `${countdown}초 뒤 시작`;
                startSecTimer();
                redraw();
                break;
            }
            case 'go':
                if (!player) break;
                if (msg.data.timeLimitMs > 0) timeLimitMs = msg.data.timeLimitMs;
                countdown = 0;
                phase = 'playing';
                announce = '시작';
                input.clear();
                if (!frozen) loop.start();
                break;
            case 'garbage_queued':
                pending = msg.data.pending;
                break;
            case 'garbage_apply':
                if (player && phase === 'playing') {
                    sendAll(versusGarbage(player, msg.data.lines, msg.data.hole));
                    dirty = true;
                    if (player.game.over) onLocalOver();
                    else if (!loop.running) render();
                }
                pending = msg.data.pending;
                break;
            case 'opponent_state':
                oppBoard = msg.data.board;
                oppLines = msg.data.lines;
                oppScore = msg.data.score;
                oppPending = msg.data.pending;
                oppDirty = true;
                if (!loop.running) render();
                break;
            case 'progress':
                lines = Math.max(lines, msg.data.you.lines);
                oppLines = msg.data.opp.lines;
                break;
            case 'opponent_disconnected':
                oppAway = msg.data.timeout;
                break;
            case 'opponent_reconnected':
                oppAway = null;
                break;
            case 'game_restored': {
                const d = msg.data;
                retry = 0;
                reconnecting = false;
                message = '';
                pending = d.pending;
                oppBoard = d.opponentBoard ?? '';
                oppLines = d.opponentLines ?? oppLines;
                oppDirty = true;
                if (d.phase === 'ready') {
                    readySent = false;
                    phase = 'matched';
                } else if (d.phase === 'playing' && player) {
                    frozen = false;
                    countdown = 0;
                    phase = 'playing';
                    input.clear();
                    if (!player.game.over) loop.start();
                    // 넘친 직후 끊겼으면 topped_out 이 안 갔을 수 있다 — 다시 알린다
                    else
                        send({
                            type: 'topped_out',
                            data: { seq: player.seq, tick: player.game.tick }
                        });
                } else if (d.phase === 'countdown' && player) {
                    frozen = false;
                } else if (!player) {
                    // 이 화면에서 시작한 판이 아니다(새로고침 등) — 이어 할 수 없다
                    blockedInGame = true;
                    phase = 'idle';
                }
                redraw();
                break;
            }
            case 'game_over': {
                if (!player) {
                    // 이 화면에서 시작하지 않은 남은 대전(기권 등으로 정리됨)
                    clearTimeout(leftoverTimer);
                    blockedInGame = false;
                    message = '남아 있던 대전이 끝났습니다. 새로 시작할 수 있습니다.';
                    send({ type: 'rematch_decline', data: {} });
                    closeSocket();
                    break;
                }
                loop.stop();
                input.clear();
                stopSecTimerIfIdle();
                message = '';
                result = msg.data;
                myStats = { ...myStats, [activeRule.id]: msg.data.stats };
                rematchState = 'none';
                rematchOffer = null;
                rematchLeft = msg.data.rematchSeconds ?? 30;
                phase = 'over';
                announce = msg.data.youWon
                    ? '승리했습니다'
                    : msg.data.winner === null
                      ? '무승부입니다'
                      : '패배했습니다';
                startSecTimer();
                redraw();
                break;
            }
            case 'rematch_offer':
                rematchOffer = msg.data;
                announce = '상대가 재대결을 신청했습니다';
                break;
            case 'rematch_canceled': {
                const why: Record<string, string> = {
                    declined: '상대가 재대결을 거절했습니다.',
                    expired: '재대결 시간이 지났습니다.',
                    left: '상대가 나갔습니다.',
                    unavailable: '지금은 재대결을 할 수 없습니다.'
                };
                rematchState = 'closed';
                rematchOffer = null;
                rematchLeft = 0;
                message = msg.data.message ?? why[msg.data.reason] ?? '재대결이 취소되었습니다.';
                break;
            }
            case 'error':
                if (msg.data.code === 'no_game') {
                    // 복구·준비할 대전이 서버에 없다 (그사이 끝났거나 취소됨)
                    resetGame();
                    phase = 'idle';
                    closeSocket();
                    message = msg.data.message || '대전이 이미 끝났습니다.';
                    break;
                }
                // 받아들이지 않은 입력 등 — 판은 계속된다
                if (msg.data.message) message = msg.data.message;
                break;
        }
    }

    /** 내 판이 넘쳤다 — 결과(game_over)는 서버가 보낸다 */
    function onLocalOver() {
        loop.stop();
        input.clear();
        toppedOut = true;
        announce = '판이 넘쳤습니다';
        dirty = true;
        render();
    }

    /* ── 엔진 ── */

    function stepGame() {
        if (!player || frozen) return;
        const r = versusTick(player, input.sample());
        sendAll(r.out);
        if (r.dirty) dirty = true;
        const g = player.game;
        if (g.score !== score) score = g.score;
        if (g.lines !== lines) lines = g.lines;
        if (g.level !== level) level = g.level;
        const left = remainingSeconds(timeLimitMs, g.tick);
        if (left !== timeLeft) timeLeft = left;
        if (r.cleared > 0) announce = `${r.cleared}줄 지움`;
        if (g.over) onLocalOver();
    }

    /* ── 그리기 ── */

    function redraw() {
        dirty = true;
        oppDirty = true;
        render();
    }

    function render() {
        if (dirty && boardEl && nextEl) {
            dirty = false;
            const g = player?.game;
            const ctx = fitCanvas(boardEl);
            if (ctx && g) {
                const w = boardEl.clientWidth;
                drawBoard(ctx, g.board, w / COLS, {
                    width: w,
                    height: boardEl.clientHeight,
                    grid: getComputedStyle(boardEl).color,
                    piece: phase === 'playing' && !g.over ? g.piece : null
                });
            }
            const nctx = fitCanvas(nextEl);
            if (nctx) {
                const show = g && (phase === 'playing' || phase === 'countdown') && !g.over;
                drawNext(nctx, nextEl.clientWidth, nextEl.clientHeight, g && show ? g.next : null);
            }
        }
        if (oppDirty && oppEl) {
            oppDirty = false;
            const octx = fitCanvas(oppEl);
            if (octx) {
                const w = oppEl.clientWidth;
                drawBoard(octx, oppBoard, w / COLS, {
                    width: w,
                    height: oppEl.clientHeight,
                    grid: getComputedStyle(oppEl).color
                });
            }
        }
    }

    /* ── 초 단위 표시(준비·카운트다운·재대결) ── */

    function startSecTimer() {
        if (secTimer) return;
        secTimer = setInterval(() => {
            if (readyLeft > 0) readyLeft--;
            if (rematchLeft > 0) rematchLeft--;
            if (countdown > 1) countdown--;
            stopSecTimerIfIdle();
        }, 1000);
    }

    function stopSecTimerIfIdle() {
        if (secTimer && readyLeft <= 0 && rematchLeft <= 0 && countdown <= 1) {
            clearInterval(secTimer);
            secTimer = null;
        }
    }

    /* ── 로비 ── */

    async function fetchLobby() {
        lobbyAt = Date.now();
        try {
            const r = await fetch(`${STACK_API_BASE}/lobby`);
            if (!r.ok) return;
            const body = await r.json();
            const w = body?.waiting;
            if (w && typeof w === 'object') {
                const next: Partial<Record<RuleId, number>> = {};
                for (const id of RULE_IDS) if (typeof w[id] === 'number') next[id] = w[id];
                lobby = next;
            }
        } catch {
            // 표시용 정보 — 실패는 조용히 (다음 폴링에서 회복)
        }
    }

    function lobbyWanted(): boolean {
        return !document.hidden && (phase === 'idle' || phase === 'queued');
    }

    /* ── 터치 ── */

    function padDown(e: PointerEvent, bit: number) {
        e.preventDefault();
        if (phase !== 'playing' || frozen) return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        input.press(bit);
    }

    function padClick(e: MouseEvent, bit: number) {
        if (e.detail !== 0 || phase !== 'playing' || frozen) return;
        input.press(bit);
        input.release(bit);
    }

    function fmtTime(sec: number): string {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    $effect(() =>
        untrack(() => {
            // 초대 링크로 들어온 경우 — /games/stack?invite=코드&rule=규칙
            const params = new URLSearchParams(location.search);
            const code = params.get('invite');
            if (code && /^[a-zA-Z0-9]{4,32}$/.test(code)) {
                const r = params.get('rule');
                inviteFromUrl = { code, rule: isRuleId(r) ? r : 'attack' };
                rule = inviteFromUrl.rule;
            }

            // 로비 폴링 15초 — 탭이 숨겨져 있거나 대전 중이면 건너뛴다
            void fetchLobby();
            const poll = setInterval(() => {
                if (lobbyWanted()) void fetchLobby();
            }, LOBBY_POLL_MS);
            const onVisible = () => {
                if (lobbyWanted() && Date.now() - lobbyAt >= LOBBY_POLL_MS) void fetchLobby();
            };
            document.addEventListener('visibilitychange', onVisible);

            const offKeys = bindKeys(
                KEYMAP,
                input,
                () => active && phase === 'playing' && !frozen && !!player && !player.game.over
            );
            const offBoard = observeSize(boardEl, () => {
                dirty = true;
                render();
            });
            const offOpp = observeSize(oppEl, () => {
                oppDirty = true;
                render();
            });
            return () => {
                destroyed = true;
                clearInterval(poll);
                document.removeEventListener('visibilitychange', onVisible);
                offKeys();
                offBoard();
                offOpp();
                loop.stop();
                if (secTimer) clearInterval(secTimer);
                clearTimeout(leftoverTimer);
                closeSocket();
            };
        })
    );
</script>

<div class="stack-online flex select-none flex-col gap-3">
    {#if message}
        <p class="text-sm text-amber-600 dark:text-amber-400" role="status">{message}</p>
    {/if}

    {#if blockedInGame}
        <div class="space-y-2 rounded-lg border p-3">
            <p class="text-sm">
                끝나지 않은 대전이 남아 있습니다(다른 창이나 새로고침 전에 하던 판). 이어서 할 수
                없어 기권해야 새로 시작할 수 있습니다.
            </p>
            <button
                type="button"
                class="bg-muted text-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                onclick={surrenderLeftover}>남은 대전 기권</button
            >
        </div>
    {/if}

    {#if phase === 'idle'}
        {#if inviteFromUrl}
            <div class="space-y-2 rounded-lg border-2 border-emerald-500/50 bg-emerald-500/5 p-3">
                <p class="text-sm font-medium">
                    초대받은 대전이 있습니다 · {RULES[inviteFromUrl.rule].label} (참가비 없음)
                </p>
                <p class="text-muted-foreground text-xs">
                    초대한 앙님이 기다리고 있어야 시작됩니다. 대전 중 창을 닫거나 자리를 비우면
                    패배로 처리됩니다.
                </p>
                <button
                    type="button"
                    class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                    onclick={() =>
                        inviteFromUrl && joinInvite(inviteFromUrl.code, inviteFromUrl.rule)}
                    >초대 대전 입장</button
                >
            </div>
        {/if}

        <div class="space-y-3 rounded-lg border p-3">
            <div role="radiogroup" aria-label="대전 방식" class="grid grid-cols-2 gap-2">
                {#each RULE_IDS as id (id)}
                    <button
                        type="button"
                        role="radio"
                        aria-checked={rule === id}
                        class="rounded-lg border p-2 text-left {rule === id
                            ? 'border-primary bg-primary/5'
                            : ''}"
                        onclick={() => {
                            rule = id;
                            confirmFee = false;
                        }}
                    >
                        <span class="block text-sm font-semibold">{RULES[id].label}</span>
                        <span class="text-muted-foreground block text-[11px] leading-tight">
                            {id === 'attack'
                                ? '줄을 지워 상대에게 방해 줄을 보냅니다. 먼저 넘치면 패배'
                                : '40줄을 먼저 지우면 승리. 5분이 지나면 줄이 많은 쪽 승리'}
                        </span>
                        {#if lobby && (lobby[id] ?? 0) > 0}
                            <span
                                class="mt-1 block text-[11px] text-emerald-600 dark:text-emerald-400"
                                >지금 {lobby[id]}명 대기 중</span
                            >
                        {/if}
                    </button>
                {/each}
            </div>

            {#if ruleStats}
                <p class="text-muted-foreground text-xs">
                    내 전적({RULES[rule].label}) · 레이팅 {ruleStats.rating} · {ruleStats.wins}승
                    {ruleStats.losses}패{ruleStats.draws ? ` ${ruleStats.draws}무` : ''}
                </p>
            {/if}

            {#if confirmFee}
                <div class="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
                    <p class="text-sm font-medium">참가비 {entryFee.toLocaleString()}P</p>
                    <p class="text-muted-foreground text-xs">
                        상대가 정해져 대전이 열리는 순간 {entryFee.toLocaleString()}P가 차감됩니다.
                        기권·자리 비움·연결 끊김으로 끝나도 돌려받지 못합니다. (상대가 준비하지 않아
                        취소되면 돌려드립니다.)
                    </p>
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                            onclick={joinRandom}>확인하고 매칭 시작</button
                        >
                        <button
                            type="button"
                            class="bg-muted text-foreground rounded-md px-4 py-2 text-sm font-medium"
                            onclick={() => (confirmFee = false)}>취소</button
                        >
                    </div>
                </div>
            {:else}
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                        onclick={() => (confirmFee = true)}
                        >무작위 매칭 · 참가비 {entryFee.toLocaleString()}P</button
                    >
                    <button
                        type="button"
                        class="bg-muted text-foreground rounded-md px-4 py-2 text-sm font-medium"
                        onclick={() => void createInvite()}>친구 초대 (무료)</button
                    >
                </div>
            {/if}
            <p class="text-muted-foreground text-[11px]">
                대전 중에는 일시정지가 없습니다. 다른 탭으로 옮기면 게임이 멈춰 패배할 수 있어요.
            </p>
        </div>
    {:else if phase === 'connecting'}
        <p class="text-muted-foreground text-sm">대전 서버에 연결 중…</p>
    {:else if phase === 'queued'}
        <div class="space-y-2 rounded-lg border p-3">
            <p class="text-sm">
                {RULES[rule].label} · 상대를 찾고 있습니다…{queuePosition
                    ? ` (대기 ${queuePosition}번째)`
                    : ''}
            </p>
            {#if queueMode === 'random'}
                <p class="text-muted-foreground text-xs">
                    매칭되는 순간 참가비 {entryFee.toLocaleString()}P가 차감됩니다. 아직 차감되지
                    않았습니다.
                </p>
            {:else}
                <p class="text-muted-foreground text-xs">
                    초대 대전은 무료입니다. 친구가 링크를 열면 바로 시작합니다.
                </p>
                {#if inviteLink}
                    <p class="text-xs">
                        {inviteCopied
                            ? '초대 링크를 복사했습니다: '
                            : '이 링크를 친구에게 보내 주세요: '}
                        <span class="break-all font-mono">{inviteLink}</span>
                    </p>
                {/if}
            {/if}
            <button
                type="button"
                class="bg-muted text-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                onclick={cancelQueue}>취소</button
            >
        </div>
    {:else if phase === 'matched'}
        <div class="space-y-2 rounded-lg border p-3">
            <p class="text-sm font-medium">
                상대: {opponent?.nickname ?? '상대'}{opponent?.rating
                    ? ` (${opponent.rating})`
                    : ''} ·
                {RULES[rule].label}
            </p>
            {#if feeCharged > 0}
                <p class="text-muted-foreground text-xs">
                    참가비 {feeCharged.toLocaleString()}P가 차감되었습니다. 둘 중 한 명이라도
                    준비하지 않으면 취소되고 돌려드립니다.
                </p>
            {/if}
            {#if reconnecting}
                <p class="text-muted-foreground text-sm">다시 연결하는 중…</p>
            {:else if readySent}
                <p class="text-muted-foreground text-sm">상대가 준비하기를 기다리는 중…</p>
            {:else}
                <button
                    type="button"
                    class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                    onclick={sendReady}>준비 완료{readyLeft > 0 ? ` (${readyLeft}초)` : ''}</button
                >
            {/if}
        </div>
    {/if}

    <!-- 대전 화면 — 캔버스 크기 감시를 위해 늘 DOM 에 두고 대전 중에만 보인다 -->
    <div class="flex flex-col items-center gap-3" class:hidden={!inGame}>
        <div class="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span class="font-semibold">나</span>
            <span class="text-muted-foreground">vs</span>
            <span class="max-w-[9rem] truncate font-semibold">{opponent?.nickname ?? '상대'}</span>
            {#if oppAway !== null}
                <span class="text-xs text-amber-600 dark:text-amber-400"
                    >연결 끊김 ({oppAway}초 유예)</span
                >
            {/if}
            <span class="text-muted-foreground ml-auto tabular-nums" aria-label="남은 시간"
                >{activeRule.label} · {fmtTime(timeLeft)}</span
            >
        </div>

        {#if goal}
            <div class="grid w-full gap-1 text-xs" aria-label="진행률">
                <div class="flex items-center gap-2">
                    <span class="w-8">나</span>
                    <div class="bg-muted h-2 flex-1 overflow-hidden rounded">
                        <div
                            class="bg-primary h-full"
                            style="width: {Math.min(100, (lines / goal) * 100)}%"
                        ></div>
                    </div>
                    <span class="w-12 text-right tabular-nums">{lines}/{goal}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="w-8">상대</span>
                    <div class="bg-muted h-2 flex-1 overflow-hidden rounded">
                        <div
                            class="h-full bg-amber-500"
                            style="width: {Math.min(100, (oppLines / goal) * 100)}%"
                        ></div>
                    </div>
                    <span class="w-12 text-right tabular-nums">{oppLines}/{goal}</span>
                </div>
            </div>
        {/if}

        <div class="flex items-start justify-center gap-2">
            {#if activeRule.garbage}
                <!-- 가비지 미터 — 내게 쌓인 방해 줄 -->
                <div
                    class="bg-muted relative w-2 overflow-hidden rounded"
                    style="height: calc(var(--board-w) * {ROWS / COLS});"
                    role="meter"
                    aria-label="받을 방해 줄"
                    aria-valuemin="0"
                    aria-valuemax={GARBAGE_PENDING_MAX}
                    aria-valuenow={pending}
                >
                    <div
                        class="absolute inset-x-0 bottom-0 bg-red-500 motion-safe:transition-all"
                        style="height: {Math.min(100, (pending / GARBAGE_PENDING_MAX) * 100)}%"
                    ></div>
                </div>
            {/if}
            <div class="no-pan relative">
                <canvas
                    bind:this={boardEl}
                    class="bg-muted/40 text-border box-content block rounded-lg border shadow-sm"
                    style="width: var(--board-w); height: calc(var(--board-w) * {ROWS / COLS});"
                    role="img"
                    aria-label="내 게임판 ({COLS}칸 × {ROWS}줄)"
                ></canvas>
                {#if phase === 'countdown'}
                    <div
                        class="bg-background/70 absolute inset-0 flex items-center justify-center rounded-lg"
                    >
                        <p class="text-foreground text-5xl font-bold tabular-nums">
                            {countdown}
                        </p>
                    </div>
                {:else if phase === 'playing' && (toppedOut || reconnecting)}
                    <div
                        class="bg-background/80 absolute inset-0 flex items-center justify-center rounded-lg p-3 text-center"
                    >
                        <p class="text-foreground text-sm font-semibold">
                            {reconnecting
                                ? '다시 연결하는 중…'
                                : '판이 넘쳤습니다. 결과를 기다리는 중…'}
                        </p>
                    </div>
                {/if}
            </div>

            <div class="flex w-20 flex-col gap-2 text-xs">
                <div>
                    <p class="text-muted-foreground">다음</p>
                    <canvas
                        bind:this={nextEl}
                        class="bg-muted/40 mt-1 block h-14 w-14 rounded-md border"
                        role="img"
                        aria-label="다음 조각"
                    ></canvas>
                </div>
                <div>
                    <p class="text-muted-foreground">상대</p>
                    <canvas
                        bind:this={oppEl}
                        class="bg-muted/40 text-border mt-1 box-content block w-full rounded border"
                        style="aspect-ratio: {COLS} / {ROWS};"
                        role="img"
                        aria-label="상대 게임판"
                    ></canvas>
                    <p class="text-muted-foreground mt-0.5 tabular-nums">
                        {oppLines}줄 · {oppScore.toLocaleString()}
                    </p>
                    {#if activeRule.garbage && oppPending > 0}
                        <p class="tabular-nums text-red-600 dark:text-red-400">
                            받을 줄 {oppPending}
                        </p>
                    {/if}
                </div>
                <dl class="grid gap-0.5">
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">점수</dt>
                        <dd class="font-bold tabular-nums">{score.toLocaleString()}</dd>
                    </div>
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">줄</dt>
                        <dd class="font-bold tabular-nums">{lines}</dd>
                    </div>
                    <div class="flex justify-between">
                        <dt class="text-muted-foreground">레벨</dt>
                        <dd class="font-bold tabular-nums">{level}</dd>
                    </div>
                </dl>
            </div>
        </div>

        {#if phase === 'over' && result}
            <div class="w-full space-y-2 rounded-lg border p-3">
                <p class="text-base font-semibold">
                    {result.youWon
                        ? '승리했습니다!'
                        : result.winner === null
                          ? '무승부입니다.'
                          : '아쉽게 졌습니다.'}
                    <span class="text-muted-foreground text-sm font-normal"
                        >({REASON_TEXT[result.reason] ?? result.reason})</span
                    >
                </p>
                <p class="text-muted-foreground text-sm">
                    {result.result.lines}줄 · 점수 {result.result.score.toLocaleString()}{result
                        .result.timeMs
                        ? ` · 기록 ${(result.result.timeMs / 1000).toFixed(1)}초`
                        : ''}
                </p>
                {#if result.stats}
                    <p class="text-muted-foreground text-sm">
                        레이팅 {result.stats.rating}
                        ({result.ratingDelta >= 0 ? '+' : ''}{result.ratingDelta}) · {result.stats
                            .wins}승 {result.stats.losses}패{result.stats.draws
                            ? ` ${result.stats.draws}무`
                            : ''}
                    </p>
                {/if}

                {#if rematchState !== 'closed'}
                    <p class="text-xs">
                        {result.rematchFee > 0
                            ? `재대결하면 참가비 ${result.rematchFee.toLocaleString()}P가 다시 차감됩니다.`
                            : '초대 대전 재대결은 무료입니다.'}
                    </p>
                {/if}
                {#if rematchOffer && rematchState === 'none'}
                    <p class="text-sm font-medium">상대가 재대결을 신청했습니다.</p>
                {/if}
                <div class="flex flex-wrap items-center gap-2">
                    {#if rematchState === 'none'}
                        <button
                            type="button"
                            class="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
                            onclick={requestRematch}
                        >
                            {rematchOffer ? '재대결 수락' : '재대결'}{result.rematchFee > 0
                                ? ` (${result.rematchFee.toLocaleString()}P)`
                                : ''}{rematchLeft > 0 ? ` · ${rematchLeft}초` : ''}
                        </button>
                    {:else if rematchState === 'sent'}
                        <span class="text-muted-foreground text-sm"
                            >상대의 응답을 기다리는 중…{rematchLeft > 0
                                ? ` (${rematchLeft}초)`
                                : ''}</span
                        >
                    {/if}
                    <button
                        type="button"
                        class="bg-muted text-foreground rounded-md px-4 py-2 text-sm font-medium"
                        onclick={leaveResult}>나가기</button
                    >
                </div>
            </div>
        {/if}

        {#if phase !== 'over'}
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
            <div class="flex w-full items-center justify-between gap-2">
                <p class="text-muted-foreground text-[11px]">
                    ← → 이동 · ↑/X 회전 · Z 반대 회전 · ↓ 천천히 · 스페이스 바로 내리기
                </p>
                {#if phase === 'playing'}
                    <button
                        type="button"
                        class="bg-muted text-foreground shrink-0 rounded-md px-3 py-1.5 text-xs font-medium"
                        onclick={surrender}>기권</button
                    >
                {/if}
            </div>
        {/if}
    </div>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
</div>

<style>
    .stack-online {
        --board-w: min(52vw, 14rem);
    }
    /* 게임판·조작 버튼 위에서는 화면이 스크롤·확대되지 않는다 */
    .no-pan {
        touch-action: none;
        overscroll-behavior: contain;
        -webkit-touch-callout: none;
    }
</style>
