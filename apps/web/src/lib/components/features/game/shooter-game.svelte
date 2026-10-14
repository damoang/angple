<script lang="ts">
    // 앙 스트라이커 — 위에서 내려오는 적 편대를 쏘는 세로 슈팅 게임.
    // 규칙은 $lib/games/shooter/engine.ts(순수·결정적, 60틱 고정), 루프·입력·캔버스는 $lib/games/shell.
    // 게임 상태는 평범한 객체로 두고, 화면 숫자(HUD)만 $state 로 옮긴다.
    // 그리기는 틱 사이를 보간해(직전 틱 위치 → 지금 위치) 화면 주사율과 무관하게 부드럽게 보인다.
    // 배경은 테마와 관계없이 어두운 우주(단일 테마로 의도).
    import { untrack } from 'svelte';
    import {
        FIELD_H,
        FIELD_W,
        ITEM_HALF,
        M_FLY,
        M_WAIT,
        SCALE,
        SHIP_Y,
        SHOT_HH,
        START_X,
        createGame,
        step,
        type Game,
        type StepEvent
    } from '$lib/games/shooter/engine.js';
    import {
        ENEMY_BOSS,
        ENEMY_GRUNT,
        ENEMY_MID,
        ITEM_RAPID,
        ITEM_SHIELD
    } from '$lib/games/shooter/stages.js';
    import { createLoop, onPageHidden } from '$lib/games/shell/loop.js';
    import { bindKeys, createHeldInput } from '$lib/games/shell/input.js';
    import { fitCanvas, observeSize, prefersReducedMotion } from '$lib/games/shell/canvas.js';
    import { getGame } from '$lib/games/registry.js';

    const NAME = getGame('shooter').name;
    const BEST_KEY = 'angple_shooter_best';

    const IN_LEFT = 1;
    const IN_RIGHT = 2;
    /** KeyboardEvent.code → 입력 비트 */
    const KEYMAP: Record<string, number> = {
        ArrowLeft: IN_LEFT,
        KeyA: IN_LEFT,
        ArrowRight: IN_RIGHT,
        KeyD: IN_RIGHT
    };
    /** 키보드로 비행기를 움직이는 속도(논리 px/틱) */
    const KEY_SPEED = 5;
    /** 손가락이 이만큼(CSS px) 안 움직이고 짧게 떼면 탭(= 일시정지) */
    const TAP_SLOP = 8;
    const TAP_MS = 220;

    /* ── 그림: 직접 그린 픽셀 그림 (한 칸 = 논리 2px) ── */
    const PX = 2;
    /** '#' 몸통 · 'o' 눈·조종석 · 'x' 장식 · '.' 빈칸 */
    const SHIP_ART = [
        '......#......',
        '.....###.....',
        '.....#o#.....',
        '.....#o#.....',
        '....##o##....',
        '....#####....',
        'x..#######..x',
        '#..#######..#',
        '#.#########.#',
        '#############',
        '##.##.#.##.##',
        '#....###....#',
        '.....x.x.....'
    ];
    const GRUNT_ART = [
        '...#####...',
        '..#######..',
        '.##o###o##.',
        '.#########.',
        '##.#####.##',
        '#..#.#.#..#',
        '...#...#...'
    ];
    const MID_ART = [
        '##.........##',
        '###..###..###',
        '.###########.',
        '..##o###o##..',
        '...#######...',
        '..##.###.##..',
        '.##.......##.'
    ];
    const BOSS_ART = [
        '.#...#.#...#.',
        '.##.#####.##.',
        '..#########..',
        '.####o#o####.',
        '#############',
        '##.#######.##',
        '#..##...##..#',
        '...#.....#...'
    ];
    interface Palette {
        body: string;
        eye: string;
        accent: string;
    }
    /** 다모앙 색 — 비행기는 노랑, 적은 종류마다 다른 색 */
    const SHIP_COLORS: Palette = { body: '#f2b544', eye: '#fff3d6', accent: '#e46b7a' };
    const ENEMY_COLORS: Record<number, Palette> = {
        [ENEMY_GRUNT]: { body: '#5b8fd9', eye: '#0f1830', accent: '#5b8fd9' },
        [ENEMY_MID]: { body: '#3fa7a0', eye: '#0f1830', accent: '#3fa7a0' },
        [ENEMY_BOSS]: { body: '#e46b7a', eye: '#0f1830', accent: '#e46b7a' }
    };
    /** 한 번 맞은 대장 */
    const BOSS_HURT: Palette = { body: '#c76aa6', eye: '#0f1830', accent: '#c76aa6' };
    /** 보너스 스테이지 적 */
    const BONUS_COLORS: Palette = { body: '#9a7fd1', eye: '#0f1830', accent: '#9a7fd1' };
    const ENEMY_ART: Record<number, string[]> = {
        [ENEMY_GRUNT]: GRUNT_ART,
        [ENEMY_MID]: MID_ART,
        [ENEMY_BOSS]: BOSS_ART
    };
    const SPACE_TOP = '#070b1a';
    const SPACE_BOTTOM = '#141a33';
    const SHOT_COLOR = '#ffe08a';
    const BULLET_COLOR = '#ff7a93';
    const ITEMS: Record<number, { color: string; label: string; name: string }> = {
        [ITEM_RAPID]: { color: '#3fa7a0', label: '≫', name: '연사 강화' },
        [ITEM_SHIELD]: { color: '#5b8fd9', label: '◆', name: '방패' }
    };

    type Status = 'idle' | 'playing' | 'paused' | 'over';

    let canvasEl: HTMLCanvasElement;
    let boardEl: HTMLDivElement;
    let rootEl: HTMLDivElement;
    let status = $state<Status>('idle');
    let score = $state(0);
    let lives = $state(0);
    let stageNo = $state(1);
    let best = $state(0);
    let rapid = $state(false);
    let shield = $state(false);
    let banner = $state('');
    let announce = $state('');
    let newBest = $state(false);

    // 반응형이 아닌 게임 상태
    let game: Game = createGame(1);
    let targetX = START_X;
    let reduceMotion = false;
    let bannerTimer: ReturnType<typeof setTimeout> | undefined;
    /** 터치 끌기: 시작 위치와 그때의 비행기 x */
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
    interface Popup {
        x: number;
        y: number;
        text: string;
        life: number;
    }
    interface Star {
        x: number;
        y: number;
        speed: number;
        size: number;
        alpha: number;
    }
    let particles: Particle[] = [];
    let popups: Popup[] = [];
    let stars: Star[] = [];
    let shakeUntil = 0;
    let lastFrame = 0;
    /** 픽셀 그림을 화면 배율에 맞춰 미리 그려 둔 캔버스 (배율이 바뀌면 다시) */
    const sprites = new Map<string, HTMLCanvasElement>();
    let spriteScale = 0;

    const input = createHeldInput({ repeat: 0, hold: IN_LEFT | IN_RIGHT });
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

    function clampTarget(x: number): number {
        return Math.min(FIELD_W, Math.max(0, x));
    }

    function makeStars() {
        stars = [];
        for (let k = 0; k < 70; k++) {
            const near = k % 5 === 0;
            stars.push({
                x: Math.random() * FIELD_W,
                y: Math.random() * FIELD_H,
                speed: near ? 60 : 20 + Math.random() * 20,
                size: near ? 2 : 1,
                alpha: near ? 0.9 : 0.35 + Math.random() * 0.4
            });
        }
    }

    function syncHud() {
        score = game.score;
        lives = game.lives;
        stageNo = game.stageNo;
        rapid = game.rapidTicks > 0;
        shield = game.shield;
    }

    function showBanner(text: string, ms = 1600) {
        banner = text;
        clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => (banner = ''), ms);
    }

    function tick() {
        const bits = input.sample();
        const dir = (bits & IN_RIGHT ? 1 : 0) - (bits & IN_LEFT ? 1 : 0);
        if (dir !== 0) targetX = clampTarget(game.shipX / SCALE + dir * KEY_SPEED);
        const ev = step(game, { x: Math.round(targetX) });
        if (ev.length > 0) handleEvents(ev);
        syncHud();
        if (game.over) finish();
    }

    function handleEvents(ev: StepEvent[]) {
        for (const e of ev) {
            if (e.type === 'kill') {
                const color = game.bonus ? BONUS_COLORS.body : ENEMY_COLORS[e.kind].body;
                burst(e.x / SCALE, e.y / SCALE, color, 8);
                if (e.dive || game.bonus) popup(e.x / SCALE, e.y / SCALE, `${e.points}`);
            } else if (e.type === 'damage') {
                burst(e.x / SCALE, e.y / SCALE, BOSS_HURT.body, 3);
            } else if (e.type === 'squad') {
                popup(e.x / SCALE, e.y / SCALE, `편대 +${e.bonus.toLocaleString()}`);
                showBanner(`편대 격추! +${e.bonus.toLocaleString()}`, 1400);
            } else if (e.type === 'hit') {
                burst(game.shipX / SCALE, SHIP_Y, SHIP_COLORS.body, 16);
                if (!reduceMotion) shakeUntil = performance.now() + 300;
                announce = game.lives > 0 ? `맞았습니다. 목숨 ${game.lives}개` : '';
            } else if (e.type === 'shield') {
                showBanner('방패가 막았습니다', 1000);
            } else if (e.type === 'extend') {
                showBanner('목숨 +1', 1400);
                announce = `목숨 +1. 목숨 ${game.lives}개`;
            } else if (e.type === 'catch') {
                const item = ITEMS[e.kind];
                if (item) showBanner(item.name, 900);
            } else if (e.type === 'clear') {
                showBanner('스테이지 클리어!', 1800);
            } else if (e.type === 'bonus-result') {
                const text = `보너스 ${e.hits}/${e.total} · +${e.bonus.toLocaleString()}`;
                showBanner(text, 2200);
                announce = text;
            } else if (e.type === 'stage') {
                const text = e.bonus ? `스테이지 ${e.stageNo} · 보너스` : `스테이지 ${e.stageNo}`;
                showBanner(text, 1600);
                announce = text;
            }
        }
    }

    /** 폭발 파편 — 움직임 줄이기 설정이면 만들지 않는다 */
    function burst(x: number, y: number, color: string, n: number) {
        if (reduceMotion || particles.length > 150) return;
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2;
            const v = 40 + Math.random() * 120;
            particles.push({
                x,
                y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                life: 0.4 + Math.random() * 0.2,
                color
            });
        }
    }

    function popup(x: number, y: number, text: string) {
        if (popups.length > 12) popups.shift();
        popups.push({ x, y, text, life: 0.8 });
    }

    function start() {
        loop.stop();
        input.clear();
        game = createGame(newSeed());
        targetX = START_X;
        drag = null;
        particles = [];
        popups = [];
        newBest = false;
        syncHud();
        status = 'playing';
        announce = '게임 시작. 비행기는 자동으로 쏩니다';
        showBanner('스테이지 1');
        render(1);
        loop.start();
        if (document.hidden) pause();
        // 판 아래(비행기 줄)가 화면 밖이면 현황 줄이 머리글 바로 아래 오도록 올린다
        if (boardEl.getBoundingClientRect().bottom > window.innerHeight) {
            rootEl.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
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
        game.shipPrevX = game.shipX;
        for (const s of game.shots) s.py = s.y;
        for (const e of game.enemies) {
            e.px = e.x;
            e.py = e.y;
        }
        for (const b of game.bullets) {
            b.px = b.x;
            b.py = b.y;
        }
        for (const it of game.items) it.py = it.y;
    }

    function resume() {
        if (status !== 'paused') return;
        input.clear();
        settlePrev();
        targetX = game.shipX / SCALE;
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
        announce = `게임 끝. 점수 ${game.score}, 스테이지 ${game.stageNo}`;
        render(1);
    }

    /* ── 그리기 ── */

    /** 픽셀 그림 하나를 배율 scale(논리 1px 당 실제 픽셀)에 맞춰 캔버스에 그려 둔다 */
    function sprite(key: string, art: string[], pal: Palette, scale: number): HTMLCanvasElement {
        if (scale !== spriteScale) {
            sprites.clear();
            spriteScale = scale;
        }
        const hit = sprites.get(key);
        if (hit) return hit;
        const w = art[0].length;
        const h = art.length;
        const cell = PX * scale;
        const c = document.createElement('canvas');
        c.width = Math.ceil(w * cell);
        c.height = Math.ceil(h * cell);
        const sctx = c.getContext('2d');
        if (sctx) {
            for (let r = 0; r < h; r++) {
                for (let q = 0; q < w; q++) {
                    const ch = art[r].charAt(q);
                    if (ch === '.') continue;
                    sctx.fillStyle = ch === 'o' ? pal.eye : ch === 'x' ? pal.accent : pal.body;
                    // 칸 경계를 정수 픽셀로 맞춰 틈이 보이지 않게 한다
                    const x0 = Math.floor(q * cell);
                    const y0 = Math.floor(r * cell);
                    sctx.fillRect(
                        x0,
                        y0,
                        Math.floor((q + 1) * cell) - x0,
                        Math.floor((r + 1) * cell) - y0
                    );
                }
            }
        }
        sprites.set(key, c);
        return c;
    }

    function drawSprite(
        ctx: CanvasRenderingContext2D,
        img: HTMLCanvasElement,
        art: string[],
        x: number,
        y: number
    ) {
        const w = art[0].length * PX;
        const h = art.length * PX;
        ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    }

    function drawSpace(ctx: CanvasRenderingContext2D, dt: number) {
        const grad = ctx.createLinearGradient(0, 0, 0, FIELD_H);
        grad.addColorStop(0, SPACE_TOP);
        grad.addColorStop(1, SPACE_BOTTOM);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, FIELD_W, FIELD_H);
        // 별 흐름 — 움직임 줄이기 설정이면 멈춘 별
        const move = !reduceMotion && status === 'playing';
        for (const s of stars) {
            if (move) {
                s.y += s.speed * dt;
                if (s.y > FIELD_H) {
                    s.y -= FIELD_H;
                    s.x = Math.random() * FIELD_W;
                }
            }
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
    }

    function drawEnemies(ctx: CanvasRenderingContext2D, a: number, scale: number) {
        for (const e of game.enemies) {
            if (e.mode === M_WAIT) continue;
            const x = (e.px + (e.x - e.px) * a) / SCALE;
            const y = (e.py + (e.y - e.py) * a) / SCALE;
            const art = ENEMY_ART[e.kind] ?? GRUNT_ART;
            let key = `e${e.kind}`;
            let pal = ENEMY_COLORS[e.kind] ?? ENEMY_COLORS[ENEMY_GRUNT];
            if (e.mode === M_FLY) {
                key = `b${e.kind}`;
                pal = BONUS_COLORS;
            } else if (e.kind === ENEMY_BOSS && e.hp === 1) {
                key = 'hurt';
                pal = BOSS_HURT;
            }
            drawSprite(ctx, sprite(key, art, pal, scale), art, x, y);
        }
    }

    function drawShots(ctx: CanvasRenderingContext2D, a: number) {
        ctx.fillStyle = SHOT_COLOR;
        for (const s of game.shots) {
            const y = (s.py + (s.y - s.py) * a) / SCALE;
            ctx.fillRect(s.x / SCALE - 1.5, y - SHOT_HH, 3, SHOT_HH * 2);
        }
        ctx.fillStyle = BULLET_COLOR;
        for (const b of game.bullets) {
            const x = (b.px + (b.x - b.px) * a) / SCALE;
            const y = (b.py + (b.y - b.py) * a) / SCALE;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawItems(ctx: CanvasRenderingContext2D, a: number) {
        if (game.items.length === 0) return;
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const it of game.items) {
            const style = ITEMS[it.kind];
            if (!style) continue;
            const x = it.x / SCALE;
            const y = (it.py + (it.y - it.py) * a) / SCALE;
            ctx.fillStyle = style.color;
            ctx.beginPath();
            ctx.arc(x, y, ITEM_HALF, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(style.label, x, y + 0.5);
        }
    }

    function drawShip(ctx: CanvasRenderingContext2D, a: number, scale: number) {
        if (status === 'idle' || game.dead > 0 || (game.over && game.lives <= 0)) return;
        const x = (game.shipPrevX + (game.shipX - game.shipPrevX) * a) / SCALE;
        // 무적 동안 깜빡임 (움직임 줄이기 설정이면 깜빡이지 않고 반투명)
        if (game.invuln > 0) {
            if (reduceMotion) ctx.globalAlpha = 0.5;
            else if (Math.floor(game.invuln / 6) % 2 === 1) return;
        }
        drawSprite(ctx, sprite('ship', SHIP_ART, SHIP_COLORS, scale), SHIP_ART, x, SHIP_Y);
        ctx.globalAlpha = 1;
        if (game.shield) {
            ctx.strokeStyle = 'rgba(120, 180, 255, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, SHIP_Y, 18, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function drawEffects(ctx: CanvasRenderingContext2D, dt: number) {
        let w = 0;
        for (const p of particles) {
            p.life -= dt;
            if (p.life <= 0) continue;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.globalAlpha = Math.min(1, p.life * 2.5);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
            particles[w++] = p;
        }
        particles.length = w;
        if (popups.length > 0) {
            ctx.font = 'bold 11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            w = 0;
            for (const p of popups) {
                p.life -= dt;
                if (p.life <= 0) continue;
                if (!reduceMotion) p.y -= 20 * dt;
                ctx.globalAlpha = Math.min(1, p.life * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(p.text, p.x, p.y);
                popups[w++] = p;
            }
            popups.length = w;
        }
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
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const scale = k * dpr;
        const frameDt = status === 'playing' ? dt : 0;
        ctx.clearRect(0, 0, cw, ch);
        ctx.save();
        ctx.scale(k, k);
        ctx.imageSmoothingEnabled = false;
        if (now < shakeUntil) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);

        drawSpace(ctx, frameDt);
        drawItems(ctx, a);
        if (status !== 'idle') drawEnemies(ctx, a, scale);
        drawShots(ctx, a);
        drawShip(ctx, a, scale);
        drawEffects(ctx, frameDt);
        ctx.restore();
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
     * 게임(일시정지)으로 가게 한다.
     */
    function press(fn: () => void) {
        return (e: MouseEvent) => {
            (e.currentTarget as HTMLElement | null)?.blur();
            fn();
        };
    }

    function onPointerDown(e: PointerEvent) {
        if (status !== 'playing') return;
        // 버튼·링크는 그 자체 동작에 맡긴다
        if (e.target instanceof Element && e.target.closest('button, a')) return;
        if (e.pointerType === 'mouse') {
            if (e.button === 0) targetX = clampTarget(toLogicalX(e.clientX));
            return;
        }
        e.preventDefault();
        rootEl.setPointerCapture?.(e.pointerId);
        drag = {
            id: e.pointerId,
            startX: e.clientX,
            startTarget: game.shipX / SCALE,
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
        // 손가락이 움직인 만큼 비행기가 따라간다 — 손가락은 비행기 아래(판 아래쪽)에 두면 가리지 않는다
        const rect = canvasEl.getBoundingClientRect();
        const scale = rect.width > 0 ? FIELD_W / rect.width : 1;
        targetX = clampTarget(drag.startTarget + dx * scale);
    }

    function onPointerUp(e: PointerEvent) {
        if (!drag || drag.id !== e.pointerId) return;
        const tap = !drag.moved && performance.now() - drag.at < TAP_MS;
        drag = null;
        if (tap) pause();
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
        if (status === 'playing') pause();
        else if (status === 'paused') resume();
        else start();
        e.preventDefault();
    }

    $effect(() =>
        untrack(() => {
            reduceMotion = prefersReducedMotion();
            best = loadBest();
            makeStars();
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
            const offSize = observeSize(boardEl, () => render(1));
            syncHud();
            render(1);
            return () => {
                loop.stop();
                offKeys();
                offHidden();
                offSize();
                motion?.removeEventListener?.('change', onMotion);
                for (const [type, fn] of pointer) {
                    rootEl.removeEventListener(type, fn as EventListener);
                }
                clearTimeout(bannerTimer);
                sprites.clear();
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
            <dd class="text-foreground font-bold tabular-nums">{stageNo}</dd>
        </div>
        <div>
            <dt class="text-muted-foreground text-xs">목숨</dt>
            <dd class="font-bold tabular-nums text-amber-500" aria-label="목숨 {lives}개">
                {'▲'.repeat(Math.max(0, Math.min(lives, 6)))}{#if lives === 0}<span
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
            class="block h-full w-full rounded-lg border bg-slate-950 shadow-sm"
            role="img"
            aria-label="{NAME} 게임판"
        ></canvas>

        {#if status === 'playing' && (rapid || shield)}
            <div class="pointer-events-none absolute left-2 top-2 flex gap-1 text-xs font-bold">
                {#if rapid}
                    <span class="rounded-md bg-teal-500/80 px-2 py-0.5 text-white">연사</span>
                {/if}
                {#if shield}
                    <span class="rounded-md bg-blue-500/80 px-2 py-0.5 text-white">방패</span>
                {/if}
            </div>
        {/if}

        {#if banner && status === 'playing'}
            <p
                class="pointer-events-none absolute left-1/2 top-[45%] -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/80 px-3 py-1 text-sm font-bold text-white shadow-sm"
            >
                {banner}
            </p>
        {/if}

        {#if status !== 'playing'}
            <div
                class="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-950/75 p-4 text-center text-white"
            >
                {#if status === 'idle'}
                    <p class="text-2xl font-bold">{NAME}</p>
                    <p class="text-xs text-slate-300">
                        비행기는 자동으로 쏩니다. 좌우로 움직여 적 편대를 떨어뜨리세요
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
                    <p class="text-lg font-bold">게임 끝</p>
                    <p class="text-sm">
                        점수 <span class="font-bold tabular-nums">{score.toLocaleString()}</span>
                    </p>
                    <p class="text-xs text-slate-300">
                        스테이지 {stageNo}
                        {#if newBest}· 최고 기록!{/if}
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
        마우스 · ← → / A D 이동 · 사격은 자동 · 스페이스 시작/일시정지 · 휴대폰은 판 아래쪽을 좌우로
        끌고 탭하면 일시정지
    </p>
</div>

<style>
    /*
     * 논리 판 360×640(9:16)을 기기 폭에 맞춰 키운다. 단, 판 전체(아래 비행기 줄 포함)가 화면 높이 안에
     * 들어오게 높이 예산으로도 줄인다: 판 높이 ≤ 100svh − 8rem (벽돌깨기와 같은 예산).
     *   8rem(128px) = 고정 머리글 64 + 여백 8 + 현황 줄 약 36 + 간격 12 = 120, 여유 8.
     *   판 폭 = 높이 × 9/16 이므로 폭 상한 = (100svh − 8rem) × 9/16.
     * 360×640 폰: 폭 상한 = (640 − 128) × 9/16 = 288 → 판 288×512. 72 + 48 + 512 = 632 ≤ 640.
     *   주소창이 보여 svh 가 560 이면 폭 243·높이 432 → 72 + 48 + 432 = 552 ≤ 560.
     * 아주 낮은 화면에서도 너무 작아지지 않게 폭은 14rem 이상. PC 에서는 24rem(384px) 이 상한.
     */
    .board {
        width: min(100%, 24rem, max(14rem, calc((100vh - 8rem) * 9 / 16)));
    }
    @supports (height: 100svh) {
        .board {
            width: min(100%, 24rem, max(14rem, calc((100svh - 8rem) * 9 / 16)));
        }
    }
    .field {
        aspect-ratio: 9 / 16;
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
