<script lang="ts">
    // 벽돌깨기 — 막대로 공을 튕겨 벽돌을 깨는 게임.
    // 규칙은 $lib/games/breakout/engine.ts(순수·결정적, 60틱 고정), 루프·입력·캔버스는 $lib/games/shell.
    // 게임 상태는 평범한 객체로 두고, 화면 숫자(HUD)만 $state 로 옮긴다.
    // 그리기는 틱 사이를 보간해(직전 틱 위치 → 지금 위치) 화면 주사율과 무관하게 부드럽게 보인다.
    import { untrack } from 'svelte';
    import {
        BALL_R,
        BRICK_COLS,
        BRICK_H,
        BRICK_LEFT,
        BRICK_ROWS,
        BRICK_TOP,
        BRICK_W,
        FIELD_W,
        ITEM_H,
        ITEM_W,
        PADDLE_H,
        PADDLE_Y,
        SCALE,
        START_X,
        createGame,
        step,
        type Game,
        type StepEvent
    } from '$lib/games/breakout/engine.js';
    import {
        BRICK_HARD2,
        BRICK_HARD3,
        BRICK_NONE,
        BRICK_SOLID,
        ITEM_LIFE,
        ITEM_MULTI,
        ITEM_SLOW,
        ITEM_WIDE
    } from '$lib/games/breakout/stages.js';
    import { createLoop, onPageHidden } from '$lib/games/shell/loop.js';
    import { bindKeys, createHeldInput } from '$lib/games/shell/input.js';
    import { fitCanvas, observeSize, prefersReducedMotion } from '$lib/games/shell/canvas.js';
    import { getGame } from '$lib/games/registry.js';
    import { encodeLog } from '$lib/games/breakout/log-codec.js';
    import {
        BREAKOUT_RANKED_MAX_MINUTES,
        BREAKOUT_RANKED_MAX_TICKS
    } from '$lib/games/breakout/ranked.js';
    import {
        RANK_START_GAP_MS,
        finishScoreRun,
        startScoreRun,
        type ScoreFinishResult,
        type ScoreRun
    } from '$lib/games/score-ranking.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import GameScoreRanking from './game-score-ranking.svelte';

    const NAME = getGame('breakout').name;
    const BEST_KEY = 'angple_breakout_best';
    /** 순위 API 의 게임 id */
    const RANK_GAME = 'breakout';
    const LOGIN_HREF = '/login?redirect=%2Fgames%2Fbreakout';
    /** 서버 시작 간격(5초)에 더 두는 여유 */
    const GAP_MARGIN_MS = 1000;
    /** 첫 판이 서버 판을 기다리는 최대 시간 */
    const FIRST_START_WAIT_MS = 3000;
    /** 미리 받은 판을 쓰는 최대 나이 — 서버 만료(2시간)보다 넉넉히 짧게 */
    const READY_MAX_AGE_MS = 60 * 60 * 1000;

    const IN_LEFT = 1;
    const IN_RIGHT = 2;
    /** KeyboardEvent.code → 입력 비트 */
    const KEYMAP: Record<string, number> = {
        ArrowLeft: IN_LEFT,
        KeyA: IN_LEFT,
        ArrowRight: IN_RIGHT,
        KeyD: IN_RIGHT
    };
    /** 키보드로 막대를 움직이는 속도(논리 px/틱) */
    const KEY_SPEED = 7;
    /** 손가락이 이만큼(CSS px) 안 움직이고 짧게 떼면 탭 */
    const TAP_SLOP = 8;
    const TAP_MS = 300;

    /** 벽돌 색 — 줄마다 다르게. 밝은/어두운 테마 모두에서 보이는 중간 채도 */
    const ROW_COLORS = [
        '#f2b544',
        '#ef8a5b',
        '#e46b7a',
        '#c76aa6',
        '#9a7fd1',
        '#5b8fd9',
        '#3fa7a0',
        '#8fb65a',
        '#d9a441',
        '#e8836b'
    ];
    const HARD_COLORS: Record<number, string> = {
        [BRICK_HARD2]: '#6d7fa8',
        [BRICK_HARD3]: '#4f5f86'
    };
    const SOLID_COLOR = '#8a8f98';
    const PADDLE_COLOR = '#f2b544';
    const ITEMS: Record<number, { color: string; label: string; name: string }> = {
        [ITEM_WIDE]: { color: '#3fa7a0', label: '↔', name: '넓은 막대' },
        [ITEM_MULTI]: { color: '#5b8fd9', label: '×3', name: '공 여러 개' },
        [ITEM_SLOW]: { color: '#9a7fd1', label: '느림', name: '느린 공' },
        [ITEM_LIFE]: { color: '#e46b7a', label: '♥', name: '목숨 +1' }
    };

    type Status = 'idle' | 'playing' | 'paused' | 'over';
    /** 순위 기록 상태: local=로컬 판(기록 미등록), server=서버 판 진행 중 */
    type RecordState = 'none' | 'local' | 'server' | 'saving' | 'saved' | 'failed';

    let canvasEl: HTMLCanvasElement;
    let boardEl: HTMLDivElement;
    let rootEl: HTMLDivElement;
    let status = $state<Status>('idle');
    let score = $state(0);
    let lives = $state(0);
    let stageNo = $state(1);
    let round = $state(1);
    let combo = $state(0);
    let best = $state(0);
    let waiting = $state(true);
    let banner = $state('');
    let announce = $state('');
    let newBest = $state(false);
    /** 첫 판이 서버 판을 잠깐 기다리는 중 */
    let starting = $state(false);
    let record = $state<RecordState>('none');
    /** 마지막으로 낸 기록의 결과 */
    let standing = $state<ScoreFinishResult | null>(null);
    /** 기록 관련 짧은 안내 */
    let notice = $state('');
    /** 기록이 순위에 들어갈 때마다 1씩 — 순위 카드를 다시 불러온다 */
    let rankingRefresh = $state(0);
    /** 끝난 화면의 내 기록 한 줄 — 「이번 주 n위 · 내 최고 x점」 */
    const standingText = $derived(
        standing
            ? [
                  standing.rankWeek ? `이번 주 ${standing.rankWeek}위` : '기록 저장됨',
                  standing.best !== null ? `내 최고 ${standing.best.toLocaleString()}점` : ''
              ]
                  .filter(Boolean)
                  .join(' · ')
            : ''
    );

    // 순위 판 (반응형 아님)
    /** 서버가 발급한 이번 판 id (로컬 판이면 null) */
    let runId: string | null = null;
    /** 시작할 때마다 오른다 — 늦게 온 응답이 새 판을 덮지 않게 */
    let startGen = 0;
    let destroyed = false;
    /** 이번 방문에서 한 판이라도 시작했는가 — 첫 판만 서버 판을 잠깐 기다린다 */
    let played = false;
    /** 순위 표가 아직 없다는 답을 받았는가 — 그러면 이번 방문 동안 서버 판을 다시 청하지 않는다 */
    let rankNotReady = false;
    /** 마지막으로 서버에 판 시작을 요청한 시각 */
    let lastServerStart = 0;
    /** 미리 받아 둔 다음 판 */
    let ready: { run: ScoreRun; at: number } | null = null;
    /** 다음 판을 받아 오는 중이면 그 작업 */
    let fetching: Promise<void> | null = null;
    /** 끝난 판 기록을 내는 중이면 그 작업 — 새 판 요청은 이게 끝난 뒤에(서버는 회원당 판 1개) */
    let submitting: Promise<void> | null = null;

    // 반응형이 아닌 게임 상태
    let game: Game = createGame(1);
    let targetX = START_X;
    let launchQueued = false;
    let reduceMotion = false;
    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    let fg = '#111';
    /** 터치 끌기: 시작 위치와 그때의 막대 목표 */
    let drag: {
        id: number;
        startX: number;
        startTarget: number;
        at: number;
        moved: boolean;
    } | null = null;

    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        color: string;
    }
    let particles: Particle[] = [];
    let shakeUntil = 0;
    let lastFrame = 0;
    /** 벽돌 층 — 벽돌이 바뀔 때만 다시 그려 두고 매 프레임에는 통째로 붙인다 */
    let brickLayer: HTMLCanvasElement | null = null;
    let bricksDirty = true;

    const input = createHeldInput({ repeat: 0, hold: IN_LEFT | IN_RIGHT });
    const loop = createLoop(tick, render);

    function newSeed(): number {
        try {
            return crypto.getRandomValues(new Uint32Array(1))[0];
        } catch {
            return (Math.random() * 4294967296) >>> 0;
        }
    }

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * 다음 판을 뒤에서 미리 받아 둔다 — 로그인 회원만. 서버의 시작 간격(5초 + 여유 1초)을 지켜서 부르고,
     * 그래도 간격 제한(429)이면 간격만큼 기다려 한 번 더 부른다. 받지 못했으면 그 판은 로컬로 바로 시작.
     */
    function prefetch(): Promise<void> {
        if (fetching) return fetching;
        if (ready || destroyed || rankNotReady || !authStore.isAuthenticated) {
            return Promise.resolve();
        }
        const work = (async () => {
            if (submitting) await submitting;
            for (let attempt = 0; attempt < 2; attempt++) {
                const wait = lastServerStart + RANK_START_GAP_MS + GAP_MARGIN_MS - Date.now();
                if (wait > 0) await sleep(wait);
                if (destroyed) return;
                lastServerStart = Date.now();
                const r = await startScoreRun(RANK_GAME);
                if (destroyed) return;
                if (r === 'rate_limited') continue;
                if (r === 'not_ready') rankNotReady = true;
                else if (r) ready = { run: r, at: Date.now() };
                return;
            }
        })().finally(() => {
            fetching = null;
        });
        fetching = work;
        return work;
    }

    /** 미리 받은 판을 꺼낸다(한 번만). 너무 오래됐으면 버린다 */
    function takeReady(): ScoreRun | null {
        const r = ready;
        ready = null;
        if (!r || !authStore.isAuthenticated) return null;
        return Date.now() - r.at < READY_MAX_AGE_MS ? r.run : null;
    }

    /** 서버 판이면 기록을 낸다 — 실패해도 게임 화면은 그대로 */
    async function submitRecord() {
        const id = runId;
        runId = null;
        if (!id) return;
        if (game.tick > BREAKOUT_RANKED_MAX_TICKS) {
            // 순위 판 길이 상한을 넘긴 판 — 내지 않는다(서버 판은 만료로 사라진다)
            record = 'local';
            notice = `${BREAKOUT_RANKED_MAX_MINUTES}분을 넘긴 판은 랭킹에 기록되지 않습니다`;
            return;
        }
        const gen = startGen;
        record = 'saving';
        const body = {
            runId: id,
            score: game.score,
            ticks: game.tick,
            inputs: encodeLog(game.log)
        };
        const res = await finishScoreRun(RANK_GAME, body);
        if (gen !== startGen || destroyed) return;
        standing = res;
        record = res ? 'saved' : 'failed';
        if (res?.accepted) {
            if (res.best !== null && res.best > best) {
                best = res.best;
                saveBest(best);
            }
            rankingRefresh++;
        }
    }

    function loadBest(): number {
        try {
            return Number(localStorage.getItem(BEST_KEY)) || 0;
        } catch {
            return 0;
        }
    }

    function saveBest(value: number) {
        try {
            localStorage.setItem(BEST_KEY, String(value));
        } catch {
            // 저장 불가(사생활 보호 모드 등) — 이번 방문 동안만 기억
        }
    }

    /** 막대 목표를 판 안으로 자른다 (막대 폭이 바뀌어도 맞게) */
    function clampTarget(x: number): number {
        const half = game.paddleHalf / SCALE;
        return Math.min(FIELD_W - half, Math.max(half, x));
    }

    function syncHud() {
        score = game.score;
        lives = game.lives;
        stageNo = game.stage + 1;
        round = game.loop + 1;
        combo = game.combo;
        waiting = game.attached;
    }

    function showBanner(text: string, ms = 1600) {
        banner = text;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => (banner = ''), ms);
    }

    function tick() {
        const bits = input.sample();
        const dir = (bits & IN_RIGHT ? 1 : 0) - (bits & IN_LEFT ? 1 : 0);
        if (dir !== 0) targetX = clampTarget(targetX + dir * KEY_SPEED);
        const ev = step(game, { x: Math.round(targetX), launch: launchQueued });
        launchQueued = false;
        if (ev.length > 0) handleEvents(ev);
        syncHud();
        if (game.over) finish();
    }

    function handleEvents(ev: StepEvent[]) {
        for (const e of ev) {
            if (e.type === 'brick' || e.type === 'clear') bricksDirty = true;
            if (e.type === 'brick' && e.broken) {
                burst(e.col, e.row, e.kind);
            } else if (e.type === 'catch') {
                const item = ITEMS[e.kind];
                if (item) showBanner(item.name, 900);
            } else if (e.type === 'life-lost') {
                if (!reduceMotion) shakeUntil = performance.now() + 250;
                announce = game.lives > 0 ? `공을 놓쳤습니다. 목숨 ${game.lives}개` : '';
            } else if (e.type === 'clear') {
                const next = game.stage + 1;
                const text = `클리어! +${e.bonus.toLocaleString()} · 스테이지 ${next}`;
                showBanner(text, 2000);
                announce = text;
            }
        }
    }

    /** 깨진 벽돌 파편 — 움직임 줄이기 설정이면 만들지 않는다 */
    function burst(col: number, row: number, kind: number) {
        if (reduceMotion || particles.length > 120) return;
        const cx = BRICK_LEFT + col * BRICK_W + BRICK_W / 2;
        const cy = BRICK_TOP + row * BRICK_H + BRICK_H / 2;
        const color = brickColor(kind, row);
        for (let k = 0; k < 6; k++) {
            particles.push({
                x: cx,
                y: cy,
                vx: (Math.random() - 0.5) * 160,
                vy: (Math.random() - 0.8) * 140,
                life: 0.45,
                color
            });
        }
    }

    /** 새 판 — 로그인 회원의 첫 판만 서버 판(시드)을 잠깐(최대 3초) 기다린다 */
    function start() {
        if (starting) return;
        const gen = ++startGen;
        loop.stop();
        input.clear();
        runId = null;
        standing = null;
        notice = '';
        const run = takeReady();
        if (!run && !played && !rankNotReady && authStore.isAuthenticated) {
            starting = true;
            void Promise.race([prefetch(), sleep(FIRST_START_WAIT_MS)]).then(() => {
                starting = false;
                if (gen !== startGen || destroyed) return;
                begin(takeReady());
            });
            return;
        }
        begin(run);
    }

    function begin(run: ScoreRun | null) {
        if (run) {
            runId = run.runId;
        } else if (authStore.isAuthenticated) {
            notice = rankNotReady
                ? '랭킹 준비 중이라 이번 판은 기록되지 않습니다'
                : played
                  ? '기록 준비 전에 시작해 이번 판은 랭킹에 기록되지 않습니다'
                  : '기록 서버에 연결하지 못해 이번 판은 랭킹에 기록되지 않습니다';
        }
        played = true;
        record = runId ? 'server' : 'local';
        game = createGame(run ? run.seed : newSeed());
        targetX = START_X;
        launchQueued = false;
        drag = null;
        particles = [];
        bricksDirty = true;
        newBest = false;
        syncHud();
        status = 'playing';
        announce = '게임 시작. 스페이스나 탭으로 공을 쏘세요';
        showBanner('스테이지 1');
        render(1);
        loop.start();
        if (document.hidden) pause();
        // 판 아래(막대 줄)가 화면 밖이면 현황 줄이 머리글 바로 아래 오도록 올린다
        if (boardEl.getBoundingClientRect().bottom > window.innerHeight) {
            rootEl.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
        // 로컬 판이면 지금부터 다음 판을 받아 둔다(서버 판 진행 중에는 부르지 않는다 — 판이 바뀌므로)
        if (!runId) void prefetch();
    }

    function pause() {
        if (status !== 'playing') return;
        loop.stop();
        input.clear();
        drag = null;
        status = 'paused';
        announce = '일시정지';
        render(1);
    }

    /** 직전 틱 위치를 지금 위치로 — 다시 시작할 때 보간이 한 틱 뒤로 튀지 않게 */
    function settlePrev() {
        game.paddlePrevX = game.paddleX;
        for (const b of game.balls) {
            b.px = b.x;
            b.py = b.y;
        }
        for (const it of game.items) it.py = it.y;
    }

    function resume() {
        if (status !== 'paused') return;
        input.clear();
        settlePrev();
        status = 'playing';
        announce = '계속';
        loop.start();
    }

    function finish() {
        loop.stop();
        input.clear();
        drag = null;
        status = 'over';
        if (game.score > best) {
            best = game.score;
            newBest = true;
            saveBest(best);
        }
        announce = `게임 끝. 점수 ${game.score}, 스테이지 ${game.stage + 1}`;
        render(1);
        // 기록을 낸 뒤 다음 판을 받아 둔다 — 다시 시작할 때 기다리지 않게
        submitting = submitRecord().finally(() => {
            submitting = null;
        });
        void submitting.then(() => prefetch());
    }

    /* ── 그리기 ── */

    function brickColor(kind: number, row: number): string {
        if (kind === BRICK_SOLID) return SOLID_COLOR;
        return HARD_COLORS[kind] ?? ROW_COLORS[row % ROW_COLORS.length];
    }

    /** roundRect 가 없는 브라우저(iOS 15 등)에서는 각진 사각형으로 그린다 */
    function rrect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
    ) {
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
        ctx.fill();
    }

    function drawBricks(ctx: CanvasRenderingContext2D) {
        for (let r = 0; r < BRICK_ROWS; r++) {
            for (let c = 0; c < BRICK_COLS; c++) {
                const i = r * BRICK_COLS + c;
                const kind = game.kinds[i];
                if (kind === BRICK_NONE) continue;
                const x = BRICK_LEFT + c * BRICK_W + 1;
                const y = BRICK_TOP + r * BRICK_H + 1;
                const w = BRICK_W - 2;
                const h = BRICK_H - 2;
                ctx.fillStyle = brickColor(kind, r);
                rrect(ctx, x, y, w, h, 3);
                // 윗부분 광택
                ctx.fillStyle = 'rgba(255,255,255,0.22)';
                ctx.fillRect(x + 2, y + 2, w - 4, 3);
                if (kind === BRICK_SOLID) {
                    // 안 깨지는 벽돌: 빗금
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    for (let k = 4; k < w; k += 7) {
                        ctx.moveTo(x + k, y + h - 1);
                        ctx.lineTo(x + k + 5, y + 1);
                    }
                    ctx.stroke();
                } else if (kind === BRICK_HARD2 || kind === BRICK_HARD3) {
                    // 단단한 벽돌: 남은 횟수만큼 점
                    ctx.fillStyle = 'rgba(255,255,255,0.85)';
                    const n = game.hp[i];
                    const gap = 6;
                    const sx = x + w / 2 - ((n - 1) * gap) / 2;
                    for (let k = 0; k < n; k++) {
                        ctx.beginPath();
                        ctx.arc(sx + k * gap, y + h / 2 + 1, 1.6, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }
    }

    /** 벽돌 층을 캔버스 크기에 맞춰 준비한다 (벽돌이 바뀌었거나 크기가 바뀌었을 때만 다시 그림) */
    function readyBrickLayer(w: number, h: number, k: number): HTMLCanvasElement | null {
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const pw = Math.round(w * dpr);
        const ph = Math.round(h * dpr);
        if (pw <= 0 || ph <= 0) return null;
        brickLayer ??= document.createElement('canvas');
        if (brickLayer.width !== pw || brickLayer.height !== ph) {
            brickLayer.width = pw;
            brickLayer.height = ph;
            bricksDirty = true;
        }
        if (bricksDirty) {
            const lctx = brickLayer.getContext('2d');
            if (!lctx) return null;
            lctx.setTransform(1, 0, 0, 1, 0, 0);
            lctx.clearRect(0, 0, pw, ph);
            lctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
            drawBricks(lctx);
            bricksDirty = false;
        }
        return brickLayer;
    }

    function drawItems(ctx: CanvasRenderingContext2D, alpha: number) {
        if (game.items.length === 0) return;
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const it of game.items) {
            const style = ITEMS[it.kind];
            if (!style) continue;
            const x = it.x / SCALE;
            const y = (it.py + (it.y - it.py) * alpha) / SCALE;
            ctx.fillStyle = style.color;
            rrect(ctx, x - ITEM_W / 2, y - ITEM_H / 2, ITEM_W, ITEM_H, ITEM_H / 2);
            ctx.fillStyle = '#fff';
            ctx.fillText(style.label, x, y + 0.5);
        }
    }

    function drawParticles(ctx: CanvasRenderingContext2D, dt: number) {
        if (particles.length === 0) return;
        let w = 0;
        for (const p of particles) {
            p.life -= dt;
            if (p.life <= 0) continue;
            p.vy += 400 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.globalAlpha = Math.min(1, p.life * 2.5);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
            particles[w++] = p;
        }
        particles.length = w;
        ctx.globalAlpha = 1;
    }

    function render(alpha = 1) {
        if (!canvasEl) return;
        const ctx = fitCanvas(canvasEl);
        if (!ctx) return;
        const now = performance.now();
        const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
        lastFrame = now;
        const a = status === 'playing' ? Math.min(1, Math.max(0, alpha)) : 1;
        const cw = canvasEl.clientWidth;
        const ch = canvasEl.clientHeight;
        const k = cw / FIELD_W;
        const layer = readyBrickLayer(cw, ch, k);
        ctx.clearRect(0, 0, cw, ch);
        ctx.save();
        ctx.scale(k, k);
        if (now < shakeUntil) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

        if (layer) ctx.drawImage(layer, 0, 0, cw / k, ch / k);
        else drawBricks(ctx);
        drawItems(ctx, a);

        // 막대
        const px = (game.paddlePrevX + (game.paddleX - game.paddlePrevX) * a) / SCALE;
        const half = game.paddleHalf / SCALE;
        ctx.fillStyle = PADDLE_COLOR;
        rrect(ctx, px - half, PADDLE_Y, half * 2, PADDLE_H, PADDLE_H / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(px - half + 4, PADDLE_Y + 2, half * 2 - 8, 2);

        // 공
        if (status !== 'idle') {
            // 테마 색을 못 읽는 브라우저면 회색으로 남는다
            ctx.fillStyle = '#888';
            ctx.fillStyle = fg;
            for (const b of game.balls) {
                const x = (b.px + (b.x - b.px) * a) / SCALE;
                const y = (b.py + (b.y - b.py) * a) / SCALE;
                ctx.beginPath();
                ctx.arc(x, y, BALL_R, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        drawParticles(ctx, status === 'playing' ? dt : 0);
        ctx.restore();
    }

    /** 테마(밝게/어둡게)가 바뀌면 캔버스 글자색을 다시 읽는다 */
    function readColors() {
        if (!canvasEl) return;
        fg = getComputedStyle(canvasEl).color || fg;
    }

    /* ── 입력 ── */

    /** 화면 x(CSS px) → 논리 x */
    function toLogicalX(clientX: number): number {
        const rect = canvasEl.getBoundingClientRect();
        if (rect.width <= 0) return targetX;
        return ((clientX - rect.left) * FIELD_W) / rect.width;
    }

    /**
     * 버튼 클릭 처리 — 누른 뒤 포커스를 버튼에서 빼서, 이어지는 스페이스·엔터가 그 버튼을 다시 누르지 않고
     * 게임(발사·일시정지)으로 가게 한다.
     */
    function press(fn: () => void) {
        return (e: MouseEvent) => {
            (e.currentTarget as HTMLElement | null)?.blur();
            fn();
        };
    }

    function requestLaunch() {
        if (status === 'playing' && game.attached) launchQueued = true;
    }

    function onPointerDown(e: PointerEvent) {
        if (status !== 'playing') return;
        // 버튼·링크는 그 자체 동작에 맡긴다
        if (e.target instanceof Element && e.target.closest('button, a')) return;
        if (e.pointerType === 'mouse') {
            if (e.button !== 0) return;
            targetX = clampTarget(toLogicalX(e.clientX));
            requestLaunch();
            return;
        }
        e.preventDefault();
        rootEl.setPointerCapture?.(e.pointerId);
        drag = {
            id: e.pointerId,
            startX: e.clientX,
            startTarget: targetX,
            at: performance.now(),
            moved: false
        };
    }

    function onPointerMove(e: PointerEvent) {
        if (status !== 'playing') return;
        if (e.pointerType === 'mouse') {
            targetX = clampTarget(toLogicalX(e.clientX));
            return;
        }
        if (!drag || drag.id !== e.pointerId) return;
        const dx = e.clientX - drag.startX;
        if (Math.abs(dx) > TAP_SLOP) drag.moved = true;
        // 손가락이 움직인 만큼 막대가 따라간다 (손가락 아래가 아니어도 된다)
        const rect = canvasEl.getBoundingClientRect();
        const scale = rect.width > 0 ? FIELD_W / rect.width : 1;
        targetX = clampTarget(drag.startTarget + dx * scale);
    }

    function onPointerUp(e: PointerEvent) {
        if (!drag || drag.id !== e.pointerId) return;
        const tap = !drag.moved && performance.now() - drag.at < TAP_MS;
        drag = null;
        if (tap) requestLaunch();
    }

    function onPointerCancel(e: PointerEvent) {
        if (drag && drag.id === e.pointerId) drag = null;
    }

    function onCommandKey(e: KeyboardEvent) {
        if (e.repeat) return;
        if (e.code === 'KeyP' || e.code === 'Escape') {
            if (status === 'playing') pause();
            else if (status === 'paused') resume();
            else return;
            e.preventDefault();
            return;
        }
        if (e.code !== 'Space' && e.code !== 'Enter') return;
        // 포커스가 페이지 본문이나 게임 영역 안에 있을 때만 받는다 (다른 컨트롤·스크롤을 가로채지 않게).
        // 버튼에 포커스가 있으면 버튼 자체 클릭에 맡긴다 (두 번 실행 방지)
        const t = e.target;
        const inGame = t instanceof Node && !!rootEl && rootEl.contains(t);
        if (t !== document.body && t !== document.documentElement && !inGame) return;
        if (t instanceof HTMLButtonElement) return;
        if (status === 'playing') {
            if (game.attached) requestLaunch();
            else if (e.code === 'Space') pause();
            else return;
        } else if (status === 'paused') resume();
        else start();
        e.preventDefault();
    }

    $effect(() =>
        untrack(() => {
            reduceMotion = prefersReducedMotion();
            best = loadBest();
            readColors();
            const offKeys = bindKeys(KEYMAP, input, () => status === 'playing', onCommandKey);
            const offHidden = onPageHidden(pause);
            // 게임 영역 전체(판 + 둘레)의 끌기·탭·마우스 — 영역이 그림·글이라 리스너를 직접 붙인다
            const pointer: Array<[string, (e: PointerEvent) => void]> = [
                ['pointerdown', onPointerDown],
                ['pointermove', onPointerMove],
                ['pointerup', onPointerUp],
                ['pointercancel', onPointerCancel]
            ];
            for (const [type, fn] of pointer) {
                rootEl.addEventListener(type, fn as EventListener, { passive: false });
            }
            // 움직임 줄이기 설정은 게임 중에도 바뀔 수 있다
            const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
            const onMotion = () => {
                reduceMotion = !!motion?.matches;
                if (reduceMotion) {
                    particles = [];
                    shakeUntil = 0;
                }
            };
            motion?.addEventListener?.('change', onMotion);
            const offSize = observeSize(boardEl, () => {
                readColors();
                render(1);
            });
            // 테마 전환은 <html> 의 class 로 온다
            const mo =
                typeof MutationObserver === 'undefined'
                    ? null
                    : new MutationObserver(() => {
                          readColors();
                          if (status !== 'playing') render(1);
                      });
            mo?.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'data-theme']
            });
            syncHud();
            render(1);
            // 로그인 회원이면 첫 판을 미리 받아 둔다 — 시작을 눌렀을 때 기다리지 않게
            void prefetch();
            return () => {
                destroyed = true;
                loop.stop();
                offKeys();
                offHidden();
                offSize();
                mo?.disconnect();
                motion?.removeEventListener?.('change', onMotion);
                for (const [type, fn] of pointer) {
                    rootEl.removeEventListener(type, fn as EventListener);
                }
                clearTimeout(bannerTimer);
            };
        })
    );
</script>

<div
    bind:this={rootEl}
    class="game-area flex select-none flex-col items-center gap-3"
    class:no-pan={status === 'playing'}
>
    <dl class="board grid grid-cols-4 gap-2 text-center text-sm" aria-label="{NAME} 현황">
        <div>
            <dt class="text-muted-foreground text-xs">점수</dt>
            <dd class="text-foreground font-bold tabular-nums">{score.toLocaleString()}</dd>
        </div>
        <div>
            <dt class="text-muted-foreground text-xs">스테이지</dt>
            <dd class="text-foreground font-bold tabular-nums">
                {stageNo}{#if round > 1}<span class="text-muted-foreground text-xs">
                        · {round}바퀴</span
                    >{/if}
            </dd>
        </div>
        <div>
            <dt class="text-muted-foreground text-xs">목숨</dt>
            <dd class="font-bold tabular-nums text-rose-500" aria-label="목숨 {lives}개">
                {'♥'.repeat(Math.max(0, lives))}{#if lives === 0}<span
                        class="text-muted-foreground">-</span
                    >{/if}
            </dd>
        </div>
        <div>
            <dt class="text-muted-foreground text-xs">최고</dt>
            <dd class="text-foreground tabular-nums">{best.toLocaleString()}</dd>
        </div>
    </dl>

    <div bind:this={boardEl} class="board field relative" class:no-pan={status === 'playing'}>
        <canvas
            bind:this={canvasEl}
            class="bg-muted/40 text-foreground block h-full w-full rounded-lg border shadow-sm"
            role="img"
            aria-label="{NAME} 게임판"
        ></canvas>

        {#if status === 'playing' && combo >= 2}
            <p
                class="text-foreground pointer-events-none absolute right-2 top-2 rounded-md bg-amber-400/80 px-2 py-0.5 text-xs font-bold tabular-nums dark:bg-amber-500/70"
            >
                {combo} 콤보
            </p>
        {/if}

        {#if banner && status === 'playing'}
            <p
                class="text-foreground bg-background/80 pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 whitespace-nowrap rounded-md px-3 py-1 text-sm font-bold shadow-sm"
            >
                {banner}
            </p>
        {/if}

        {#if status === 'playing' && waiting && !banner}
            <p
                class="text-muted-foreground pointer-events-none absolute bottom-16 left-0 right-0 text-center text-xs"
            >
                탭 · 클릭 · 스페이스로 발사
            </p>
        {/if}

        {#if status !== 'playing'}
            <div
                class="bg-background/80 absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg p-4 text-center"
            >
                {#if status === 'idle'}
                    <p class="text-foreground text-2xl font-bold">{NAME}</p>
                    <p class="text-muted-foreground text-xs">막대로 공을 튕겨 벽돌을 모두 깨세요</p>
                    <button
                        type="button"
                        onclick={press(start)}
                        disabled={starting}
                        class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium disabled:opacity-60"
                        >{starting ? '준비 중…' : '시작'}</button
                    >
                {:else if status === 'paused'}
                    <p class="text-foreground text-lg font-bold">일시정지</p>
                    <button
                        type="button"
                        onclick={press(resume)}
                        class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                        >계속</button
                    >
                {:else}
                    <p class="text-foreground text-lg font-bold">게임 끝</p>
                    <p class="text-foreground text-sm">
                        점수 <span class="font-bold tabular-nums">{score.toLocaleString()}</span>
                    </p>
                    <p class="text-muted-foreground text-xs">
                        스테이지 {stageNo}{round > 1 ? ` · ${round}바퀴` : ''}
                        {#if newBest}· 최고 기록!{/if}
                    </p>
                    <p class="text-muted-foreground min-h-4 text-xs leading-4">
                        {#if record === 'saving'}
                            기록 저장 중…
                        {:else if record === 'saved' && standing?.accepted}
                            <span class="text-foreground">{standingText}</span>
                        {:else if record === 'saved'}
                            이번 판은 순위에 반영되지 않았습니다
                        {:else if !authStore.isAuthenticated}
                            <a href={LOGIN_HREF} class="text-primary underline"
                                >로그인하면 기록이 순위에 올라갑니다</a
                            >
                        {:else if record === 'local' || record === 'failed'}
                            기록 미등록
                        {/if}
                    </p>
                    <button
                        type="button"
                        onclick={press(start)}
                        disabled={starting}
                        class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium disabled:opacity-60"
                        >{starting ? '준비 중…' : '다시 하기'}</button
                    >
                {/if}
            </div>
        {/if}
    </div>

    {#if status === 'playing' || status === 'paused'}
        <div class="flex gap-2">
            <button
                type="button"
                onclick={press(() => (status === 'playing' ? pause() : resume()))}
                class="bg-muted text-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                >{status === 'playing' ? '일시정지' : '계속'}</button
            >
            <button
                type="button"
                onclick={press(start)}
                class="bg-muted text-foreground rounded-md px-3 py-1.5 text-xs font-medium"
                >다시 시작</button
            >
        </div>
    {/if}

    <p class="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
    <p class="text-muted-foreground text-center text-xs">
        마우스 · ← → / A D 이동 · 스페이스 발사/일시정지 · 휴대폰은 좌우로 끌고 탭하면 발사
    </p>
    <!-- 순위 기록 안내 — 한 줄 높이를 늘 잡아 둬서 아래 순위 카드가 밀리지 않게 -->
    <p class="text-muted-foreground min-h-4 text-center text-xs leading-4" aria-live="polite">
        {notice}
    </p>
</div>

<div class="mt-4">
    <GameScoreRanking
        game={RANK_GAME}
        title="{NAME} 랭킹"
        refresh={rankingRefresh}
        {standing}
        loginHref={LOGIN_HREF}
    />
</div>

<style>
    /*
     * 논리 판 360×540(2:3)을 기기 폭에 맞춰 키운다. 단, 판 전체(아래 막대 줄 포함)가 화면 높이 안에 들어오게
     * 높이 예산으로도 줄인다: 판 높이 ≤ 100svh − 8rem.
     *   8rem(128px) = 고정 머리글 64 + 여백 8 (아래 scroll-margin-top 4.5rem) + 현황 줄 약 36 + 간격 12 = 120, 여유 8.
     *   판 폭 = 높이 × 2/3 이므로 폭 상한 = (100svh − 8rem) × 2/3.
     * 360×640 폰: 폭 상한 = (640 − 128) × 2/3 ≈ 341 → 실제 폭은 칸 폭(360 − 좌우 여백 32 = 328)이
     *   더 작아 328, 판 높이 492. 72 + 48 + 492 = 612 ≤ 640.
     *   주소창이 보여 svh 가 560 이면 폭 288·높이 432 → 72 + 48 + 432 = 552 ≤ 560.
     * 아주 낮은 화면에서도 너무 작아지지 않게 폭은 16rem 이상. PC 에서는 27rem(432px) 이 상한.
     */
    .board {
        width: min(100%, 27rem, max(16rem, calc((100vh - 8rem) * 2 / 3)));
    }
    @supports (height: 100svh) {
        .board {
            width: min(100%, 27rem, max(16rem, calc((100svh - 8rem) * 2 / 3)));
        }
    }
    .field {
        aspect-ratio: 2 / 3;
    }
    /* 시작할 때 이 영역을 머리글 바로 아래로 올린다 */
    .game-area {
        scroll-margin-top: 4.5rem;
    }
    /* 게임 중에는 게임 영역에서 화면이 스크롤·확대되지 않는다 (게임 밖은 그대로 스크롤) */
    .no-pan {
        touch-action: none;
        overscroll-behavior: contain;
        -webkit-touch-callout: none;
    }
</style>
