<script lang="ts">
    // 다모앙 특공대 — 옆으로 달리며 쏘는 액션 (베타: 엔진·조작 + 짧은 시험 구간).
    // 규칙은 $lib/games/commando/engine.ts(순수·결정적, 60틱 고정), 루프·키 입력은 $lib/games/shell.
    // 게임 상태는 평범한 객체로 두고, 화면 숫자(HUD)만 $state 로 옮긴다.
    // 캔버스는 논리 해상도 384×216 그대로 그리고, CSS 로 기기 픽셀의 정수배만큼 키운다(픽셀이 선명하다).
    import { tick as afterUpdate, untrack } from 'svelte';
    import {
        OWNER_PLAYER,
        SCALE,
        START_GRENADES,
        START_LIVES,
        TILE,
        VIEW_H,
        VIEW_W,
        centerX,
        createGame,
        feetY,
        muzzle,
        step,
        type Game,
        type StepEvent
    } from '$lib/games/commando/engine.js';
    import { T_CRATE, T_PLATFORM, isSolid, tileAt } from '$lib/games/commando/physics.js';
    import {
        BTN_ALL,
        BTN_DIRS,
        BTN_FIRE,
        BTN_GRENADE,
        BTN_JUMP,
        KEYMAP,
        padBits
    } from '$lib/games/commando/input.js';
    import { CRATE_HP } from '$lib/games/commando/stages.js';
    import {
        ART,
        LEGS_CROUCH,
        LEGS_JUMP,
        LEGS_RUN,
        LEGS_STAND,
        PALETTE,
        UPPER_FORWARD,
        UPPER_UP,
        composeSoldier
    } from '$lib/games/commando/sprites.js';
    import { createLoop, onPageHidden } from '$lib/games/shell/loop.js';
    import { bindKeys, createHeldInput } from '$lib/games/shell/input.js';
    import { observeSize, prefersReducedMotion } from '$lib/games/shell/canvas.js';
    import { getGame } from '$lib/games/registry.js';

    const NAME = getGame('commando').name;
    const BEST_KEY = 'angple_commando_best';
    const S = SCALE;
    /** 지도 아래쪽 216px 을 보여 준다 — 지도 높이(224)와의 차이만큼 위를 자른다 */
    const CAM_Y = 8;
    /** 정수배 계산 때 화면 높이에서 빼 두는 몫(px): 머리글 64 + 현황 줄 약 36 + 간격 12 */
    const HEIGHT_RESERVE = 112;
    /** 세로 화면에서 판 아래 조작부 높이(px) */
    const PORTRAIT_CONTROLS = 190;
    /** 가로 화면에서 판 양옆 조작부 한쪽 폭(px, 간격 포함) — 패드·버튼 최대 136 + 12 */
    const SIDE_CONTROLS = 148;
    /** 정수배 폭이 꽉 맞춘 폭의 이 비율보다 작으면 정수배를 버리고 꽉 맞춘다 */
    const INT_MIN_RATIO = 0.8;

    type Status = 'idle' | 'playing' | 'paused' | 'over';

    let canvasEl: HTMLCanvasElement;
    let boardEl: HTMLDivElement;
    let rootEl: HTMLDivElement;
    let padEl = $state<HTMLDivElement>();
    let status = $state<Status>('idle');
    let score = $state(0);
    let lives = $state(0);
    let grenades = $state(0);
    let best = $state(0);
    let banner = $state('');
    let announce = $state('');
    let newBest = $state(false);
    let cleared = $state(false);
    let cssW = $state(VIEW_W);
    let cssH = $state(VIEW_H);
    /** 캔버스 내부 해상도 = 논리 해상도 × bufScale (정수) */
    let bufScale = $state(1);
    /** 가로 화면 조작부(패드·버튼 묶음) 한 변(px) — 판 높이를 넘지 않는다 */
    let ctlSize = $state(136);
    let touch = $state(false);
    let portrait = $state(false);
    let knobX = $state(0);
    let knobY = $state(0);

    // 반응형이 아닌 게임 상태
    let game: Game = createGame(1);
    let reduceMotion = false;
    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    let padPointer = -1;
    let padHeld = 0;

    interface Particle {
        x: number;
        y: number;
        vx: number;
        vy: number;
        life: number;
        color: string;
    }
    interface Boom {
        x: number;
        y: number;
        life: number;
    }
    let particles: Particle[] = [];
    let booms: Boom[] = [];
    let shakeUntil = 0;
    let lastFrame = 0;
    /** 픽셀 그림 → 1배 캔버스 (논리 해상도 그대로, 좌우 뒤집은 것·하얗게 번쩍인 것 따로) */
    const sprites = new Map<string, HTMLCanvasElement>();

    const input = createHeldInput({ repeat: 0, hold: BTN_ALL });
    const loop = createLoop(tick, render);

    function newSeed(): number {
        try {
            return crypto.getRandomValues(new Uint32Array(1))[0];
        } catch {
            return (Math.random() * 4294967296) >>> 0;
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

    function syncHud() {
        score = game.score;
        lives = game.lives;
        grenades = game.player.grenades;
    }

    function showBanner(text: string, ms = 1600) {
        banner = text;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => (banner = ''), ms);
    }

    function tick() {
        const ev = step(game, input.sample());
        if (ev.length > 0) handleEvents(ev);
        syncHud();
        if (game.over) finish();
    }

    function handleEvents(ev: StepEvent[]) {
        for (const e of ev) {
            if (e.type === 'kill') {
                burst(e.x / S, e.y / S, PALETTE.r, 12);
                burst(e.x / S, e.y / S, PALETTE.R, 6);
            } else if (e.type === 'hit') {
                burst(e.x / S, e.y / S, PALETTE.w, 3);
            } else if (e.type === 'crate-hit') {
                burst(e.x / S, e.y / S, PALETTE.o, 3);
            } else if (e.type === 'crate-break') {
                burst(e.x / S, e.y / S, PALETTE.o, 10);
                burst(e.x / S, e.y / S, PALETTE.O, 6);
            } else if (e.type === 'boom') {
                booms.push({ x: e.x / S, y: e.y / S, life: 0.35 });
                burst(e.x / S, e.y / S, PALETTE.y, 10);
                shake(180);
            } else if (e.type === 'die') {
                burst(e.x / S, e.y / S, PALETTE.g, 14);
                burst(e.x / S, e.y / S, PALETTE.y, 6);
                shake(250);
                announce = game.lives > 0 ? `맞았습니다. 목숨 ${game.lives}개` : '';
            } else if (e.type === 'lock') {
                showBanner('적을 모두 잡으세요!', 1800);
            } else if (e.type === 'unlock') {
                showBanner('앞으로! →', 1400);
                announce = '앞으로 갈 수 있습니다';
            } else if (e.type === 'clear') {
                cleared = true;
            }
        }
    }

    function shake(ms: number) {
        if (!reduceMotion) shakeUntil = performance.now() + ms;
    }

    /** 파편 — 움직임 줄이기 설정이면 만들지 않는다 */
    function burst(x: number, y: number, color: string, n: number) {
        if (reduceMotion || particles.length > 200) return;
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2;
            const v = 30 + Math.random() * 90;
            particles.push({
                x,
                y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v - 40,
                life: 0.3 + Math.random() * 0.3,
                color
            });
        }
    }

    function start() {
        loop.stop();
        input.clear();
        releasePad();
        game = createGame(newSeed());
        particles = [];
        booms = [];
        newBest = false;
        cleared = false;
        syncHud();
        status = 'playing';
        announce = `게임 시작. ${game.stage.name}`;
        showBanner(game.stage.name);
        render(1);
        loop.start();
        if (document.hidden) pause();
        // 판이 화면 밖으로 걸치면 현황 줄이 머리글 바로 아래 오도록 올린다
        const rect = boardEl.getBoundingClientRect();
        if (rect.bottom > window.innerHeight || rect.top < 0) {
            rootEl.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    }

    function pause() {
        if (status !== 'playing') return;
        loop.stop();
        input.clear();
        releasePad();
        status = 'paused';
        announce = '일시정지';
        render(1);
    }

    /** 직전 틱 위치를 지금 위치로 — 다시 시작할 때 보간이 한 틱 뒤로 튀지 않게 */
    function settlePrev() {
        const p = game.player;
        p.prevX = p.x;
        p.prevY = p.y;
        game.prevCamX = game.camX;
        for (const e of game.enemies) {
            e.prevX = e.x;
            e.prevY = e.y;
        }
        for (const b of game.bullets) {
            b.prevX = b.x;
            b.prevY = b.y;
        }
        for (const g of game.grenades) {
            g.prevX = g.x;
            g.prevY = g.y;
        }
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
        releasePad();
        status = 'over';
        if (game.score > best) {
            best = game.score;
            newBest = true;
            saveBest(best);
        }
        announce = cleared ? `훈련 완료. 점수 ${game.score}` : `게임 끝. 점수 ${game.score}`;
        render(1);
    }

    /* ── 크기: 기기 픽셀의 정수배 ── */

    /**
     * 판 크기.
     * fitW = 쓸 수 있는 영역(가로 화면 터치면 양옆 조작부 몫을 뺀 폭, 화면 높이 예산)에 16:9 로 꽉 맞춘 CSS 폭.
     * 기기 픽셀 정수배 k = floor(fitW × dpr / 384) 의 폭(384k / dpr)이 fitW 의 80% 이상이면 그 폭(픽셀이 고르다),
     * 아니면 fitW 그대로(조금 고르지 않아도 작아지지 않게). 캔버스 내부 해상도는 384×216 의 정수배
     * ceil(폭 × dpr / 384) 로 그려 CSS 로 줄이거나 그대로 보인다(image-rendering: pixelated).
     */
    function layout() {
        if (!boardEl) return;
        const dpr = window.devicePixelRatio || 1;
        const side = touch && !portrait;
        const availW = Math.max(0, boardEl.clientWidth - (side ? 2 * SIDE_CONTROLS : 0));
        const reserve = HEIGHT_RESERVE + (touch && portrait ? PORTRAIT_CONTROLS : 0);
        const availH = Math.max(120, window.innerHeight - reserve);
        const fitW = Math.max(VIEW_W / 4, Math.min(availW, (availH * VIEW_W) / VIEW_H));
        const k = Math.floor((fitW * dpr) / VIEW_W);
        const intW = (VIEW_W * k) / dpr;
        // 저밀도 화면(PC)에서 2배 이상이면 정수배를 지킨다 — 큰 화면에서 비정수로 번지지 않게
        const w = k >= 1 && (intW >= fitW * INT_MIN_RATIO || (dpr < 2 && k >= 2)) ? intW : fitW;
        cssW = w;
        cssH = (w * VIEW_H) / VIEW_W;
        ctlSize = Math.round(Math.min(136, Math.max(88, cssH)));
        // 내부 해상도 배율은 4 까지 (그 이상은 메모리만 든다)
        const scale = Math.min(4, Math.max(1, Math.ceil((w * dpr) / VIEW_W - 1e-6)));
        if (scale !== bufScale) {
            bufScale = scale;
            // 캔버스 크기가 바뀌면 내용이 지워진다 — 화면에 반영된 뒤 다시 그린다
            void afterUpdate().then(() => render(1));
        } else {
            render(1);
        }
    }

    /* ── 그리기 ── */

    /** 픽셀 그림 하나를 1배 캔버스로 (flip = 좌우 뒤집기, white = 하얗게 번쩍임) */
    function sprite(
        key: string,
        art: string[] | (() => string[]),
        flip = false,
        white = false
    ): HTMLCanvasElement {
        const id = `${key}${flip ? ':f' : ''}${white ? ':w' : ''}`;
        const hit = sprites.get(id);
        if (hit) return hit;
        const rows = typeof art === 'function' ? art() : art;
        const w = rows[0].length;
        const h = rows.length;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const sctx = c.getContext('2d');
        if (sctx) {
            for (let r = 0; r < h; r++) {
                for (let q = 0; q < w; q++) {
                    const ch = rows[r].charAt(q);
                    if (ch === '.') continue;
                    sctx.fillStyle = white ? PALETTE.w : (PALETTE[ch] ?? PALETTE.k);
                    sctx.fillRect(flip ? w - 1 - q : q, r, 1, 1);
                }
            }
        }
        sprites.set(id, c);
        return c;
    }

    /** 대원 그림 고르기 — [그림 이름, 합친 격자 만들기(처음 한 번만 부른다)] */
    function soldierArt(): [string, () => string[]] {
        const p = game.player;
        const upper = p.aimUp ? UPPER_UP : UPPER_FORWARD;
        const u = p.aimUp ? 'U' : 'F';
        if (p.crouch) {
            const f = p.vx !== 0 ? Math.floor(p.runTick / 8) % 2 : 0;
            return [`c${u}${f}`, () => composeSoldier(upper, null, LEGS_CROUCH[f])];
        }
        if (!p.onGround) {
            const f = p.vy < 0 ? 0 : 1;
            return [`j${u}${f}`, () => composeSoldier(upper, LEGS_JUMP[f])];
        }
        if (p.vx !== 0) {
            const f = Math.floor(p.runTick / 6) % 4;
            return [`r${u}${f}`, () => composeSoldier(upper, LEGS_RUN[f])];
        }
        return [`s${u}`, () => composeSoldier(upper, LEGS_STAND)];
    }

    /** 먼 언덕 높이(px) — 화면 효과일 뿐 규칙과 무관 */
    function hill(x: number, base: number, amp: number, len: number): number {
        return base + amp * Math.sin(x / len) + (amp / 2) * Math.sin(x / (len * 0.37) + 1.3);
    }

    function drawBackground(ctx: CanvasRenderingContext2D, cam: number) {
        ctx.fillStyle = PALETTE.c;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        // 구름 (아주 느리게)
        ctx.fillStyle = PALETTE.w;
        for (let k = 0; k < 6; k++) {
            const span = VIEW_W + 120;
            const x = Math.round((((k * 157 - cam * 0.1) % span) + span) % span) - 60;
            const y = 18 + ((k * 37) % 50);
            ctx.fillRect(x, y, 34, 6);
            ctx.fillRect(x + 6, y - 4, 20, 4);
        }
        // 먼 언덕 두 겹 (느리게 흐른다)
        for (const [color, speed, base, amp, len] of [
            [PALETTE.G, 0.2, 70, 14, 47],
            [PALETTE.e, 0.45, 46, 10, 29]
        ] as [string, number, number, number, number][]) {
            ctx.fillStyle = color;
            for (let x = 0; x < VIEW_W; x += 2) {
                const h = Math.round(hill(x + cam * speed, base, amp, len));
                ctx.fillRect(x, VIEW_H - h - 24, 2, h + 24);
            }
        }
    }

    function drawTiles(ctx: CanvasRenderingContext2D, cam: number) {
        const map = game.map;
        const c0 = Math.max(0, Math.floor(cam / TILE));
        const c1 = Math.min(map.cols - 1, c0 + Math.ceil(VIEW_W / TILE) + 1);
        for (let row = 0; row < map.rows; row++) {
            const y = row * TILE - CAM_Y;
            for (let col = c0; col <= c1; col++) {
                const t = tileAt(map, col, row);
                if (t === 0) continue;
                const x = Math.round(col * TILE - cam);
                if (t === T_PLATFORM) {
                    ctx.drawImage(sprite('platform', ART.platform), x, y);
                } else if (t === T_CRATE) {
                    ctx.drawImage(sprite('crate', ART.crate), x, y);
                    if (game.crateHp[row * map.cols + col] < CRATE_HP) {
                        ctx.drawImage(sprite('crack', ART.crack), x, y);
                    }
                } else {
                    const top = row === 0 || !isSolid(tileAt(map, col, row - 1));
                    ctx.drawImage(
                        top ? sprite('grass', ART.grass) : sprite('dirt', ART.dirt),
                        x,
                        y
                    );
                }
            }
        }
    }

    function drawGoal(ctx: CanvasRenderingContext2D, cam: number) {
        const x = Math.round(game.stage.goal * TILE - cam) + 6;
        if (x < -20 || x > VIEW_W + 20) return;
        const ground = (game.stage.ground[0]?.[2] ?? 12) * TILE - CAM_Y;
        ctx.fillStyle = PALETTE.k;
        ctx.fillRect(x, ground - 48, 2, 48);
        ctx.fillStyle = PALETTE.y;
        ctx.fillRect(x + 2, ground - 47, 14, 9);
        ctx.fillStyle = PALETTE.w;
        ctx.fillRect(x + 2, ground - 43, 14, 1);
    }

    /** 틱 사이 보간 (단위 → 화면 px, 카메라 기준) */
    function lerpPx(prev: number, cur: number, a: number, cam: number): number {
        return Math.round((prev + (cur - prev) * a) / S - cam);
    }

    function drawEnemies(ctx: CanvasRenderingContext2D, a: number, cam: number) {
        for (const e of game.enemies) {
            const x = lerpPx(e.prevX + (e.w >> 1), e.x + (e.w >> 1), a, cam);
            const feet = lerpPx(e.prevY + e.h, e.y + e.h, a, 0) - CAM_Y;
            const flash = e.hurt > 0 && e.hurt % 2 === 1;
            ctx.drawImage(sprite('dummy', ART.dummy, e.facing < 0, flash), x - 12, feet - 24);
        }
    }

    function drawPlayer(ctx: CanvasRenderingContext2D, a: number, cam: number) {
        const p = game.player;
        if (status === 'idle' || p.dead > 0) return;
        if (p.invuln > 0) {
            if (reduceMotion) ctx.globalAlpha = 0.55;
            else if (Math.floor(p.invuln / 4) % 2 === 1) return;
        }
        const cx = lerpPx(p.prevX + (p.w >> 1), centerX(p), a, cam);
        const feet = lerpPx(p.prevY + p.h, feetY(p), a, 0) - CAM_Y;
        const [key, rows] = soldierArt();
        ctx.drawImage(sprite(key, rows, p.facing < 0), cx - 12, feet - 24);
        if (p.shotFlash > 0) {
            const [mx, my] = muzzle(p);
            const dx = Math.round(mx / S) - Math.round(centerX(p) / S);
            const dy = Math.round(my / S) - Math.round(feetY(p) / S);
            ctx.drawImage(sprite('muzzle', ART.muzzle, p.facing < 0), cx + dx - 3, feet + dy - 3);
        }
        ctx.globalAlpha = 1;
    }

    function drawShots(ctx: CanvasRenderingContext2D, a: number, cam: number) {
        for (const b of game.bullets) {
            const x = lerpPx(b.prevX, b.x, a, cam);
            const y = lerpPx(b.prevY, b.y, a, 0) - CAM_Y;
            if (b.owner === OWNER_PLAYER) {
                ctx.fillStyle = PALETTE.y;
                if (b.vy !== 0) ctx.fillRect(x - 1, y - 2, 2, 4);
                else ctx.fillRect(x - 2, y - 1, 4, 2);
            } else {
                ctx.fillStyle = PALETTE.r;
                ctx.fillRect(x - 2, y - 2, 4, 4);
                ctx.fillStyle = PALETTE.w;
                ctx.fillRect(x - 1, y - 1, 2, 2);
            }
        }
        for (const g of game.grenades) {
            const x = lerpPx(g.prevX, g.x, a, cam);
            const y = lerpPx(g.prevY, g.y, a, 0) - CAM_Y;
            ctx.drawImage(sprite('grenade', ART.grenade), x - 3, y - 3);
        }
    }

    /** 픽셀 원 — 한 줄씩 정수 사각형으로 채운다 (가장자리 섞인 색 없음, 팔레트 색만) */
    function pixelDisc(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        r: number,
        color: string
    ) {
        ctx.fillStyle = color;
        for (let dy = -r; dy <= r; dy++) {
            const half = Math.floor(Math.sqrt(r * r - dy * dy));
            ctx.fillRect(x - half, y + dy, 2 * half + 1, 1);
        }
    }

    function drawEffects(ctx: CanvasRenderingContext2D, dt: number, cam: number) {
        let w = 0;
        for (const b of booms) {
            b.life -= dt;
            if (b.life <= 0) continue;
            // 움직임 줄이기 설정이면 작고 어두운 원 하나 (번쩍임 없음)
            const t = 1 - b.life / 0.35;
            const r = reduceMotion ? 10 : Math.round(8 + t * 20);
            const x = Math.round(b.x - cam);
            const y = Math.round(b.y) - CAM_Y;
            pixelDisc(ctx, x, y, r, reduceMotion ? PALETTE.O : t < 0.4 ? PALETTE.w : PALETTE.y);
            if (!reduceMotion && t >= 0.4) pixelDisc(ctx, x, y, Math.max(2, r - 8), PALETTE.r);
            booms[w++] = b;
        }
        booms.length = w;
        w = 0;
        for (const p of particles) {
            p.life -= dt;
            if (p.life <= 0) continue;
            p.vy += 240 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x - cam), Math.round(p.y) - CAM_Y, 2, 2);
            particles[w++] = p;
        }
        particles.length = w;
    }

    function render(alpha = 1) {
        if (!canvasEl) return;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) return;
        const now = performance.now();
        const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
        lastFrame = now;
        const a = status === 'playing' ? Math.min(1, Math.max(0, alpha)) : 1;
        const frameDt = status === 'playing' ? dt : 0;
        let cam = (game.prevCamX + (game.camX - game.prevCamX) * a) / S;
        ctx.setTransform(bufScale, 0, 0, bufScale, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (now < shakeUntil) {
            cam += Math.round((Math.random() - 0.5) * 4);
            ctx.translate(0, Math.round((Math.random() - 0.5) * 4));
        }
        drawBackground(ctx, cam);
        drawTiles(ctx, cam);
        drawGoal(ctx, cam);
        if (status !== 'idle') drawEnemies(ctx, a, cam);
        drawPlayer(ctx, a, cam);
        drawShots(ctx, a, cam);
        drawEffects(ctx, frameDt, cam);
        ctx.restore();
    }

    /* ── 입력: 가상 패드·버튼 ── */

    /**
     * 버튼 클릭 처리 — 누른 뒤 포커스를 버튼에서 빼서, 이어지는 스페이스·엔터가 그 버튼을 다시 누르지 않고
     * 게임(일시정지)으로 가게 한다.
     */
    function press(fn: () => void) {
        return (e: MouseEvent) => {
            (e.currentTarget as HTMLElement | null)?.blur();
            fn();
        };
    }

    function setPad(bits: number) {
        for (const bit of [1, 2, 4, 8]) {
            const want = (bits & bit) !== 0;
            const had = (padHeld & bit) !== 0;
            if (want && !had) input.press(bit);
            else if (!want && had) input.release(bit);
        }
        padHeld = bits & BTN_DIRS;
    }

    function releasePad() {
        padPointer = -1;
        if (padHeld) setPad(0);
        knobX = 0;
        knobY = 0;
    }

    function padMove(e: PointerEvent) {
        if (e.pointerId !== padPointer || !padEl) return;
        const rect = padEl.getBoundingClientRect();
        const radius = rect.width / 2;
        const dx = e.clientX - (rect.left + radius);
        const dy = e.clientY - (rect.top + rect.height / 2);
        setPad(status === 'playing' ? padBits(dx, dy, radius * 0.2) : 0);
        const len = Math.hypot(dx, dy);
        const max = radius * 0.45;
        const k = len > max ? max / len : 1;
        knobX = dx * k;
        knobY = dy * k;
    }

    function padDown(e: PointerEvent) {
        touch = true;
        if (status !== 'playing' || padPointer >= 0) return;
        e.preventDefault();
        padPointer = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        padMove(e);
    }

    function padUp(e: PointerEvent) {
        if (e.pointerId === padPointer) releasePad();
    }

    function btnDown(bit: number) {
        return (e: PointerEvent) => {
            touch = true;
            if (status !== 'playing') return;
            e.preventDefault();
            (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
            input.press(bit);
        };
    }

    function btnUp(bit: number) {
        return () => input.release(bit);
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
        if (status === 'playing') pause();
        else if (status === 'paused') resume();
        else start();
        e.preventDefault();
    }

    $effect(() =>
        untrack(() => {
            reduceMotion = prefersReducedMotion();
            best = loadBest();
            const coarse = window.matchMedia?.('(pointer: coarse)');
            const orient = window.matchMedia?.('(orientation: portrait)');
            const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
            touch = !!coarse?.matches;
            portrait = !!orient?.matches;
            const onOrient = () => {
                portrait = !!orient?.matches;
                layout();
            };
            // 움직임 줄이기 설정은 게임 중에도 바뀔 수 있다
            const onMotion = () => {
                reduceMotion = !!motion?.matches;
                if (reduceMotion) {
                    particles = [];
                    shakeUntil = 0;
                }
            };
            orient?.addEventListener?.('change', onOrient);
            motion?.addEventListener?.('change', onMotion);
            window.addEventListener('resize', layout);
            const offKeys = bindKeys(KEYMAP, input, () => status === 'playing', onCommandKey);
            const offHidden = onPageHidden(pause);
            const offSize = observeSize(boardEl, layout);
            // 손가락으로 처음 건드리면 가상 조작부를 보인다 (거친 포인터로 알려지지 않는 기기)
            const onAnyPointer = (e: PointerEvent) => {
                if (e.pointerType === 'touch') touch = true;
            };
            rootEl.addEventListener('pointerdown', onAnyPointer);
            syncHud();
            layout();
            return () => {
                loop.stop();
                offKeys();
                offHidden();
                offSize();
                rootEl.removeEventListener('pointerdown', onAnyPointer);
                window.removeEventListener('resize', layout);
                orient?.removeEventListener?.('change', onOrient);
                motion?.removeEventListener?.('change', onMotion);
                clearTimeout(bannerTimer);
                sprites.clear();
            };
        })
    );

    // 세로·가로나 조작부 유무가 바뀌면 크기를 다시 잰다
    $effect(() => {
        void touch;
        void portrait;
        untrack(layout);
    });
</script>

<div
    bind:this={rootEl}
    class="game-area flex select-none flex-col items-center gap-3"
    class:no-pan={status === 'playing'}
>
    <dl class="grid w-full max-w-md grid-cols-4 gap-2 text-center text-sm" aria-label="{NAME} 현황">
        <div>
            <dt class="text-muted-foreground text-xs">점수</dt>
            <dd class="text-foreground font-bold tabular-nums">{score.toLocaleString()}</dd>
        </div>
        <div>
            <dt class="text-muted-foreground text-xs">목숨</dt>
            <dd class="font-bold tabular-nums text-rose-500" aria-label="목숨 {lives}개">
                {'♥'.repeat(Math.max(0, Math.min(lives, START_LIVES)))}<span
                    class="text-muted-foreground">{lives === 0 ? '-' : ''}</span
                >
            </dd>
        </div>
        <div>
            <dt class="text-muted-foreground text-xs">수류탄</dt>
            <dd class="text-foreground font-bold tabular-nums" aria-label="수류탄 {grenades}개">
                {grenades}/{START_GRENADES}
            </dd>
        </div>
        <div>
            <dt class="text-muted-foreground text-xs">최고</dt>
            <dd class="text-foreground tabular-nums">{best.toLocaleString()}</dd>
        </div>
    </dl>

    {#if touch && portrait}
        <p class="text-muted-foreground text-xs">
            가로 화면 권장 — 휴대폰을 돌리면 더 크게 보입니다
        </p>
    {/if}

    <div
        bind:this={boardEl}
        class="board relative flex w-full flex-col items-center"
        class:side={touch && !portrait}
        style="--ctl: {ctlSize}px;"
    >
        <div class="relative" style="width: {cssW}px; height: {cssH}px;">
            <canvas
                bind:this={canvasEl}
                width={VIEW_W * bufScale}
                height={VIEW_H * bufScale}
                class="pixel block h-full w-full rounded-md border shadow-sm"
                role="img"
                aria-label="{NAME} 게임판"
            ></canvas>

            {#if banner && status === 'playing'}
                <p
                    class="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/80 px-3 py-1 text-sm font-bold text-white shadow-sm"
                >
                    {banner}
                </p>
            {/if}

            {#if status !== 'playing'}
                <div
                    class="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-slate-950/70 p-3 text-center text-white"
                >
                    {#if status === 'idle'}
                        <p class="text-2xl font-bold">{NAME}</p>
                        <p class="text-xs text-slate-300">
                            베타 — 시험 구간입니다. 달리고 뛰며 쏘아 끝 깃발까지 가세요
                        </p>
                        <button
                            type="button"
                            onclick={press(start)}
                            class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                            >시작</button
                        >
                    {:else if status === 'paused'}
                        <p class="text-lg font-bold">일시정지</p>
                        <button
                            type="button"
                            onclick={press(resume)}
                            class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                            >계속</button
                        >
                    {:else}
                        <p class="text-lg font-bold">{cleared ? '훈련 완료!' : '게임 끝'}</p>
                        <p class="text-sm">
                            점수 <span class="font-bold tabular-nums">{score.toLocaleString()}</span
                            >{newBest ? ' · 최고 기록!' : ''}
                        </p>
                        <button
                            type="button"
                            onclick={press(start)}
                            class="bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-medium"
                            >다시 하기</button
                        >
                    {/if}
                </div>
            {/if}
        </div>

        {#if touch}
            <div class="controls">
                <div
                    bind:this={padEl}
                    class="pad"
                    role="presentation"
                    onpointerdown={padDown}
                    onpointermove={padMove}
                    onpointerup={padUp}
                    onpointercancel={padUp}
                    onlostpointercapture={padUp}
                >
                    <span class="knob" style="transform: translate({knobX}px, {knobY}px);"></span>
                </div>
                <div class="buttons">
                    <button
                        type="button"
                        class="btn btn-grenade"
                        aria-label="수류탄"
                        onpointerdown={btnDown(BTN_GRENADE)}
                        onpointerup={btnUp(BTN_GRENADE)}
                        onpointercancel={btnUp(BTN_GRENADE)}
                        onlostpointercapture={btnUp(BTN_GRENADE)}>탄</button
                    >
                    <button
                        type="button"
                        class="btn btn-jump"
                        aria-label="점프"
                        onpointerdown={btnDown(BTN_JUMP)}
                        onpointerup={btnUp(BTN_JUMP)}
                        onpointercancel={btnUp(BTN_JUMP)}
                        onlostpointercapture={btnUp(BTN_JUMP)}>점프</button
                    >
                    <button
                        type="button"
                        class="btn btn-fire"
                        aria-label="사격"
                        onpointerdown={btnDown(BTN_FIRE)}
                        onpointerup={btnUp(BTN_FIRE)}
                        onpointercancel={btnUp(BTN_FIRE)}
                        onlostpointercapture={btnUp(BTN_FIRE)}>사격</button
                    >
                </div>
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
        ← → 이동 · ↓ 엎드리기 · ↑ 위 조준 · Z/J 사격(누르고 있으면 연사) · X/K 점프(길게 = 높이) ·
        C/L 수류탄 · 엎드려 점프 = 발판 아래로 · P 일시정지
    </p>
</div>

<style>
    /* 논리 해상도 그대로 그린 캔버스를 정수배로 키운다 — 흐려지지 않게 */
    .pixel {
        image-rendering: pixelated;
        image-rendering: crisp-edges;
    }
    @supports (image-rendering: pixelated) {
        .pixel {
            image-rendering: pixelated;
        }
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

    /*
     * 가상 조작부: 세로 화면은 판 아래, 가로 화면은 판 양옆(패드 왼쪽·버튼 오른쪽, 판 높이를 넘지 않게).
     * 판을 덮지 않는다. 터치 막기(touch-action)는 게임 중(.no-pan)일 때만 — 그 밖에는 화면을 그대로 끌 수 있다.
     */
    .controls {
        display: flex;
        width: 100%;
        max-width: 28rem;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 0.25rem 0;
    }
    .board.side {
        flex-direction: row;
        justify-content: center;
        gap: 0.75rem;
    }
    .board.side .controls {
        display: contents;
    }
    .board.side .pad {
        order: -1;
        width: var(--ctl);
        height: var(--ctl);
    }
    .board.side .buttons {
        order: 1;
        grid-template-columns: repeat(2, calc((var(--ctl) - 0.5rem) / 2));
        grid-template-rows: repeat(2, calc((var(--ctl) - 0.5rem) / 2));
    }
    .no-pan .controls,
    .no-pan .pad,
    .no-pan .btn {
        touch-action: none;
    }
    .pad {
        position: relative;
        flex-shrink: 0;
        width: 8.5rem;
        height: 8.5rem;
        border-radius: 9999px;
        background: rgb(15 23 42 / 0.35);
        border: 2px solid rgb(255 255 255 / 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .knob {
        width: 3rem;
        height: 3rem;
        border-radius: 9999px;
        background: rgb(255 255 255 / 0.75);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.3);
        pointer-events: none;
    }
    .buttons {
        flex-shrink: 0;
        display: grid;
        grid-template-columns: repeat(2, 4rem);
        grid-template-rows: repeat(2, 4rem);
        gap: 0.5rem;
    }
    .btn {
        border-radius: 9999px;
        font-size: 0.8rem;
        font-weight: 700;
        color: white;
        user-select: none;
        -webkit-user-select: none;
        border: 2px solid rgb(255 255 255 / 0.5);
    }
    .btn:active {
        filter: brightness(1.25);
        transform: scale(0.96);
    }
    .btn-fire {
        grid-column: 2;
        grid-row: 2;
        background: #e04f5f;
    }
    .btn-jump {
        grid-column: 1;
        grid-row: 2;
        background: #3fa7a0;
    }
    .btn-grenade {
        grid-column: 2;
        grid-row: 1;
        background: #b5763a;
    }
    @media (prefers-reduced-motion: reduce) {
        .btn:active {
            transform: none;
        }
    }
</style>
