<script lang="ts">
    /**
     * 장기판 — AI 연습판·온라인 대전이 같이 쓰는 SVG 보드.
     *
     * 그리기만 한다: 규칙·차례 판단은 부모가 하고, 칸을 누르면 onPointClick(x, y)로 알린다.
     * viewBox 기준이라 360px 폭에서도 가로 스크롤 없이 줄어든다.
     */
    import {
        COLS,
        ROWS,
        KIND,
        TEAM,
        pieceGlyph,
        pieceRank,
        type JanggiPiece,
        type Point
    } from '$lib/games/janggi/rules';
    import { JANGGI_TOKEN_STYLE } from '$lib/games/janggi/theme';

    interface Props {
        pieces: JanggiPiece[];
        selected?: Point | null;
        targets?: Point[];
        lastMove?: { from: Point; to: Point } | null;
        /** 장군 받는 진영(그 궁에 빨간 테) */
        checkTeam?: number | null;
        interactive?: boolean;
        /** 보드 가운데 잠깐 뜨는 큰 글자(장군!·멍군!) — id 가 바뀌면 다시 재생 */
        flash?: { text: string; id: number; tone: 'check' | 'block' } | null;
        /** 대국이 끝났을 때 보드 가운데 띠 배너 */
        banner?: { text: string; tone: 'win' | 'lose' | 'neutral' } | null;
        onPointClick?: (x: number, y: number) => void;
        label?: string;
    }

    let {
        pieces,
        selected = null,
        targets = [],
        lastMove = null,
        checkTeam = null,
        interactive = false,
        flash = null,
        banner = null,
        onPointClick,
        label = '장기판'
    }: Props = $props();

    const uid = $props.id();

    const CELL = 60;
    const PAD = 40;
    const W = PAD * 2 + (COLS - 1) * CELL; // 560
    const H = PAD * 2 + (ROWS - 1) * CELL; // 620

    const px = (x: number) => PAD + x * CELL;
    const py = (y: number) => PAD + y * CELL;

    // 판 바깥 나무 테 두께
    const FRAME = 10;

    // 크기: 궁 > 차·포·마·상 > 사·졸
    const RADIUS: Record<number, number> = { 3: 28, 2: 23, 1: 18 };
    // 알 옆면 두께 — 윗면이 이만큼 떠 있고, 아래로 3단 어두운 테가 보인다
    const DEPTH: Record<number, number> = { 3: 4.5, 2: 4, 1: 3.2 };
    const TOP_Y: Record<number, number> = { 3: -DEPTH[3] / 2, 2: -DEPTH[2] / 2, 1: -DEPTH[1] / 2 };
    const FONT: Record<number, number> = { 3: 26, 2: 21, 1: 16 };
    const HINT_FONT: Record<number, number> = { 3: 9, 2: 8, 1: 7 };

    // 실물 장기알은 팔각형 — 평평한 변이 위로 오게 22.5° 돌린 꼭짓점
    function octPoints(r: number): string {
        const pts: string[] = [];
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i + Math.PI / 8;
            pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
        }
        return pts.join(' ');
    }
    const OCT: Record<number, string> = {
        3: octPoints(RADIUS[3]),
        2: octPoints(RADIUS[2]),
        1: octPoints(RADIUS[1])
    };
    const OCT_INNER: Record<number, string> = {
        3: octPoints(RADIUS[3] - 4),
        2: octPoints(RADIUS[2] - 3.5),
        1: octPoints(RADIUS[1] - 3)
    };
    // 궁(楚/漢)만 안쪽 테를 한 줄 더 — 이중 테두리
    const OCT_KING_INNER = octPoints(RADIUS[3] - 7.5);

    // 전통 장기판 꺾쇠 자리(포·졸 자리)
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

    // 꺾쇠(╋ 모서리) — 교차점 네 귀에 ㄱ자 표시. 판 가장자리 쪽 귀는 생략, path 하나로 그린다
    const MARK_GAP = 4;
    const MARK_LEN = 9;
    const MARK_PATH = POINT_MARKS.map(([mx, my]) => {
        const cx = PAD + mx * CELL;
        const cy = PAD + my * CELL;
        let d = '';
        for (const dx of [-1, 1]) {
            if (mx + dx < 0 || mx + dx > COLS - 1) continue;
            for (const dy of [-1, 1]) {
                const ex = cx + dx * MARK_GAP;
                const ey = cy + dy * MARK_GAP;
                d += `M${ex} ${ey + dy * MARK_LEN}L${ex} ${ey}L${ex + dx * MARK_LEN} ${ey}`;
            }
        }
        return d;
    }).join('');

    // 판 안쪽 베벨 — 프레임 안쪽 모서리(위·왼쪽 그늘, 아래·오른쪽 빛)
    const BEVEL_DARK = `M${FRAME} ${H - FRAME}V${FRAME}H${W - FRAME}`;
    const BEVEL_LIGHT = `M${W - FRAME} ${FRAME}V${H - FRAME}H${FRAME}`;

    const PALACE_LINES: Array<[number, number, number, number]> = [
        [3, 0, 5, 2],
        [5, 0, 3, 2],
        [3, 7, 5, 9],
        [5, 7, 3, 9]
    ];

    const CELLS: Point[] = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) CELLS.push({ x, y });

    const KIND_NAME: Record<number, string> = {
        [KIND.GUNG]: '궁',
        [KIND.CHA]: '차',
        [KIND.SANG]: '상',
        [KIND.MA]: '마',
        [KIND.SA]: '사',
        [KIND.PO]: '포',
        [KIND.JOLE]: '졸'
    };

    // 칸 → 말 (배열 인덱스로 찾는 표, 반응형 Set·Map 대신 일반 배열)
    const occupancy = $derived.by(() => {
        const grid: (JanggiPiece | null)[] = new Array(COLS * ROWS).fill(null);
        for (const p of pieces) if (p.alive) grid[p.y * COLS + p.x] = p;
        return grid;
    });

    const targetMask = $derived.by(() => {
        const mask: boolean[] = new Array(COLS * ROWS).fill(false);
        for (const t of targets) mask[t.y * COLS + t.x] = true;
        return mask;
    });

    const checkedKing = $derived(
        checkTeam
            ? (pieces.find((p) => p.alive && p.kind === KIND.GUNG && p.team === checkTeam) ?? null)
            : null
    );

    function teamName(team: number): string {
        return team === TEAM.CHO ? '초' : '한';
    }

    function cellLabel(c: Point): string {
        const p = occupancy[c.y * COLS + c.x];
        let s = `${c.x + 1}열 ${c.y + 1}행`;
        if (p) {
            const name = p.kind === KIND.JOLE && p.team === TEAM.HAN ? '병' : KIND_NAME[p.kind];
            s += ` ${teamName(p.team)} ${name}`;
        }
        if (targetMask[c.y * COLS + c.x]) s += p ? ' · 잡을 수 있음' : ' · 이동 가능';
        if (selected && selected.x === c.x && selected.y === c.y) s += ' · 선택됨';
        return s;
    }

    function handleKey(e: KeyboardEvent, c: Point) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPointClick?.(c.x, c.y);
        }
    }
</script>

<svg
    viewBox="0 0 {W} {H}"
    class="jb mx-auto block h-auto w-full max-w-[560px] select-none"
    style={JANGGI_TOKEN_STYLE}
    role="group"
    aria-label={label}
>
    <defs>
        <linearGradient id="{uid}-wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color: var(--jb-wood-a)" />
            <stop offset="0.55" style="stop-color: var(--jb-wood-b)" />
            <stop offset="1" style="stop-color: var(--jb-wood-c)" />
        </linearGradient>
        <linearGradient id="{uid}-frame" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color: var(--jb-frame-a)" />
            <stop offset="1" style="stop-color: var(--jb-frame-b)" />
        </linearGradient>
        <!-- 나무결: 가로로 길게 늘인 잔결 + 넓은 띠결을 섞어 은은하게(옹이 없음). 판 전체에 1회만 -->
        <filter id="{uid}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
                type="fractalNoise"
                baseFrequency="0.005 0.14"
                numOctaves="3"
                seed="11"
                result="fine"
            />
            <feTurbulence
                type="fractalNoise"
                baseFrequency="0.0025 0.035"
                numOctaves="1"
                seed="4"
                result="band"
            />
            <feComposite
                in="fine"
                in2="band"
                operator="arithmetic"
                k1="0"
                k2="0.6"
                k3="0.4"
                k4="0"
            />
            <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.30  0 0 0 0 0.16  0 0 0 0 0.04  0.85 0 0 0 -0.31"
            />
            <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <!-- 알 윗면(상아·나무색, 위가 밝다) -->
        <linearGradient id="{uid}-face" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" style="stop-color: var(--jb-face-a)" />
            <stop offset="1" style="stop-color: var(--jb-face-b)" />
        </linearGradient>
        <!-- 좌상단 하이라이트 -->
        <radialGradient id="{uid}-gloss" cx="0.3" cy="0.22" r="0.6">
            <stop offset="0" style="stop-color: #fff; stop-opacity: 0.75" />
            <stop offset="0.5" style="stop-color: #fff; stop-opacity: 0.18" />
            <stop offset="1" style="stop-color: #fff; stop-opacity: 0" />
        </radialGradient>
        <!-- 옆면 두께(왼쪽 밝고 오른쪽 어둡게) -->
        <linearGradient id="{uid}-side" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style="stop-color: var(--jb-side-a)" />
            <stop offset="1" style="stop-color: var(--jb-side-b)" />
        </linearGradient>
        <!-- 바닥 그림자: filter 대신 방사 그라디언트 타원(알마다 filter 없음) -->
        <radialGradient id="{uid}-drop" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" style="stop-color: var(--jb-shadow); stop-opacity: 1" />
            <stop offset="0.6" style="stop-color: var(--jb-shadow); stop-opacity: 0.55" />
            <stop offset="1" style="stop-color: var(--jb-shadow); stop-opacity: 0" />
        </radialGradient>
    </defs>

    <!-- 판: 진한 나무 테 → 안쪽 판 → 나무결(1회) → 베벨 -->
    <rect width={W} height={H} rx="14" fill="url(#{uid}-frame)" />
    <rect
        x={FRAME}
        y={FRAME}
        width={W - FRAME * 2}
        height={H - FRAME * 2}
        rx="4"
        fill="url(#{uid}-wood)"
    />
    <rect width={W} height={H} rx="14" fill="#000" filter="url(#{uid}-grain)" />
    <rect
        x="0.75"
        y="0.75"
        width={W - 1.5}
        height={H - 1.5}
        rx="13.5"
        fill="none"
        class="jb-frame-edge"
    />
    <path d={BEVEL_DARK} class="jb-bevel-dark" />
    <path d={BEVEL_LIGHT} class="jb-bevel-light" />
    <rect
        x={PAD - 16}
        y={PAD - 16}
        width={W - (PAD - 16) * 2}
        height={H - (PAD - 16) * 2}
        fill="none"
        class="jb-line"
        stroke-width="2.5"
        rx="3"
    />
    {#each Array(ROWS) as _, r (r)}
        <line x1={px(0)} y1={py(r)} x2={px(COLS - 1)} y2={py(r)} class="jb-line" />
    {/each}
    {#each Array(COLS) as _, c (c)}
        <line x1={px(c)} y1={py(0)} x2={px(c)} y2={py(ROWS - 1)} class="jb-line" />
    {/each}
    {#each PALACE_LINES as [x1, y1, x2, y2] (x1 + '-' + y1)}
        <line x1={px(x1)} y1={py(y1)} x2={px(x2)} y2={py(y2)} class="jb-line" />
    {/each}
    <!-- 포·졸 자리 꺾쇠 (장기판엔 강 표기가 없다) -->
    <path d={MARK_PATH} class="jb-mark" />

    <!-- 직전 수 -->
    {#if lastMove}
        <rect
            x={px(lastMove.from.x) - 11}
            y={py(lastMove.from.y) - 11}
            width="22"
            height="22"
            rx="5"
            class="jb-last-from"
        />
        <rect
            x={px(lastMove.to.x) - CELL / 2 + 3}
            y={py(lastMove.to.y) - CELL / 2 + 3}
            width={CELL - 6}
            height={CELL - 6}
            rx="10"
            class="jb-last-to"
        />
    {/if}

    <!-- 이동 가능한 빈 칸 -->
    {#each targets as t, ti (ti)}
        {#if !occupancy[t.y * COLS + t.x]}
            <circle cx={px(t.x)} cy={py(t.y)} r="8" class="jb-target-dot" />
        {/if}
    {/each}

    <!-- 기물 — 배열 인덱스로 고정해 위치가 바뀌면 미끄러지듯 움직인다 -->
    {#each pieces as p, i (i)}
        {#if p.alive}
            {@const rank = pieceRank(p.kind)}
            {@const glyph = pieceGlyph(p.kind, p.team)}
            {@const r = RADIUS[rank]}
            {@const d = DEPTH[rank]}
            {@const topY = TOP_Y[rank]}
            {@const lifted = !!selected && selected.x === p.x && selected.y === p.y}
            <g
                class="jb-piece {p.team === TEAM.CHO ? 'jb-cho' : 'jb-han'} {lifted
                    ? 'jb-lifted'
                    : ''}"
                style="transform: translate({px(p.x)}px, {py(p.y)}px)"
                aria-hidden="true"
            >
                <!-- 바닥 그림자 -->
                <ellipse
                    cx="1.5"
                    cy={d / 2 + 2}
                    rx={r * 1.1}
                    ry={r * 0.92}
                    fill="url(#{uid}-drop)"
                    class="jb-ground"
                />
                <g class="jb-body">
                    <!-- 옆면 두께: 아래로 3단, 아래일수록 어둡게 -->
                    <polygon
                        points={OCT[rank]}
                        transform="translate(0 {topY + d})"
                        class="jb-side-3"
                    />
                    <polygon
                        points={OCT[rank]}
                        transform="translate(0 {topY + (d * 2) / 3})"
                        class="jb-side-2"
                    />
                    <polygon
                        points={OCT[rank]}
                        transform="translate(0 {topY + d / 3})"
                        fill="url(#{uid}-side)"
                        class="jb-side-1"
                    />
                    <g transform="translate(0 {topY})">
                        <!-- 윗면 -->
                        <polygon
                            points={OCT[rank]}
                            fill="url(#{uid}-face)"
                            class="jb-rim"
                            stroke-width="1.2"
                        />
                        <polygon points={OCT_INNER[rank]} fill="url(#{uid}-gloss)" />
                        <polygon
                            points={OCT_INNER[rank]}
                            class="jb-inlay"
                            stroke-width={rank === 3 ? 1.5 : 1}
                        />
                        {#if rank === 3}
                            <polygon points={OCT_KING_INNER} class="jb-inlay" stroke-width="0.8" />
                        {/if}
                        <!-- 음각 글자: 아래 1px 밝은 반사 + 어두운 안쪽 획 -->
                        <text
                            y={-r * 0.12 + 1}
                            font-size={FONT[rank]}
                            class="jb-glyph jb-glyph-shine"
                            text-anchor="middle"
                            dominant-baseline="central">{glyph[0]}</text
                        >
                        <text
                            y={-r * 0.12}
                            font-size={FONT[rank]}
                            class="jb-glyph"
                            text-anchor="middle"
                            dominant-baseline="central">{glyph[0]}</text
                        >
                        <text
                            y={r * 0.62}
                            font-size={HINT_FONT[rank]}
                            class="jb-hint"
                            text-anchor="middle"
                            dominant-baseline="central">{glyph[1]}</text
                        >
                    </g>
                </g>
            </g>
        {/if}
    {/each}

    <!-- 잡을 수 있는 말 -->
    {#each targets as t, ti (ti)}
        {@const victim = occupancy[t.y * COLS + t.x]}
        {#if victim}
            <circle
                cx={px(t.x)}
                cy={py(t.y)}
                r={RADIUS[pieceRank(victim.kind)] + 4}
                class="jb-target-ring"
            />
        {/if}
    {/each}

    <!-- 선택 -->
    {#if selected}
        {@const sp = occupancy[selected.y * COLS + selected.x]}
        <circle
            cx={px(selected.x)}
            cy={py(selected.y)}
            r={(sp ? RADIUS[pieceRank(sp.kind)] : 20) + 5}
            class="jb-selected"
        />
    {/if}

    <!-- 장군 -->
    {#if checkedKing}
        <circle cx={px(checkedKing.x)} cy={py(checkedKing.y)} r={RADIUS[3] + 6} class="jb-check" />
    {/if}

    <!-- 장군·멍군 알림(0.9초) — 누르는 칸 아래라 클릭을 막지 않는다 -->
    {#if flash}
        {#key flash.id}
            <text
                x={W / 2}
                y={H / 2}
                class="jb-flash jb-flash-{flash.tone}"
                text-anchor="middle"
                dominant-baseline="central"
                aria-hidden="true">{flash.text}</text
            >
        {/key}
    {/if}

    <!-- 끝 배너 -->
    {#if banner}
        <g class="jb-banner jb-banner-{banner.tone}" aria-hidden="true">
            <rect
                x={FRAME}
                y={H / 2 - 44}
                width={W - FRAME * 2}
                height="88"
                class="jb-banner-band"
            />
            <text
                x={W / 2}
                y={H / 2}
                class="jb-banner-text"
                text-anchor="middle"
                dominant-baseline="central">{banner.text}</text
            >
        </g>
    {/if}

    <!-- 누르는 칸 -->
    {#if interactive}
        {#each CELLS as c (c.y * COLS + c.x)}
            {@const idx = c.y * COLS + c.x}
            <rect
                x={px(c.x) - CELL / 2}
                y={py(c.y) - CELL / 2}
                width={CELL}
                height={CELL}
                fill="transparent"
                class="jb-hit"
                role="button"
                tabindex={occupancy[idx] || targetMask[idx] ? 0 : -1}
                aria-label={cellLabel(c)}
                onclick={() => onPointClick?.(c.x, c.y)}
                onkeydown={(e) => handleKey(e, c)}
            />
        {/each}
    {/if}
</svg>

<style>
    .jb {
        border-radius: 14px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    }
    /* 다크 모드: 판은 같은 나무색 그대로, 판 바깥(그림자·테두리)만 대비 조정 */
    :global(.dark) .jb,
    :global(.amoled) .jb {
        box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.08),
            0 6px 18px rgba(0, 0, 0, 0.6);
    }
    .jb-frame-edge {
        stroke: rgba(0, 0, 0, 0.45);
        stroke-width: 1.5;
    }
    .jb-bevel-dark {
        fill: none;
        stroke: rgba(30, 15, 0, 0.45);
        stroke-width: 2;
    }
    .jb-bevel-light {
        fill: none;
        stroke: rgba(255, 236, 200, 0.45);
        stroke-width: 1.5;
    }
    .jb-line {
        stroke: var(--jb-line);
        stroke-width: 1.3;
        stroke-linecap: square;
    }
    .jb-mark {
        fill: none;
        stroke: var(--jb-line);
        stroke-width: 1.3;
        opacity: 0.85;
    }
    .jb-last-from {
        fill: none;
        stroke: var(--jb-last);
        stroke-width: 2;
        stroke-dasharray: 4 3;
        opacity: 0.7;
    }
    .jb-last-to {
        fill: var(--jb-last);
        opacity: 0.2;
    }
    .jb-target-dot {
        fill: var(--jb-target);
        opacity: 0.8;
    }
    .jb-target-ring {
        fill: none;
        stroke: var(--jb-target);
        stroke-width: 3;
        stroke-dasharray: 6 4;
    }
    .jb-selected {
        fill: none;
        stroke: var(--jb-selected);
        stroke-width: 3.5;
    }
    .jb-check {
        fill: none;
        stroke: var(--jb-check);
        stroke-width: 4;
        animation: jb-pulse 1.1s ease-in-out infinite;
    }
    .jb-piece {
        transition: transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
        pointer-events: none;
    }
    /* 선택한 알은 살짝 떠오르고 그림자가 퍼진다 */
    .jb-body,
    .jb-ground {
        transition:
            transform 160ms ease-out,
            opacity 160ms ease-out;
    }
    .jb-ground {
        transform-box: fill-box;
        transform-origin: center;
    }
    .jb-lifted .jb-body {
        transform: translateY(-4px);
    }
    .jb-lifted .jb-ground {
        transform: translate(1px, 2px) scale(1.14);
        opacity: 0.7;
    }
    .jb-cho {
        --jb-team: var(--jb-cho);
        --jb-team-deep: var(--jb-cho-deep);
    }
    .jb-han {
        --jb-team: var(--jb-han);
        --jb-team-deep: var(--jb-han-deep);
    }
    .jb-side-1 {
        stroke: var(--jb-side-2);
        stroke-width: 0.6;
    }
    .jb-side-2 {
        fill: var(--jb-side-2);
    }
    .jb-side-3 {
        fill: var(--jb-side-3);
    }
    .jb-rim {
        stroke: var(--jb-rim);
    }
    .jb-inlay {
        fill: none;
        stroke: var(--jb-team);
        opacity: 0.6;
    }
    .jb-glyph {
        fill: var(--jb-team);
        stroke: var(--jb-team-deep);
        stroke-width: 0.7;
        stroke-linejoin: round;
        font-family: 'Noto Serif KR', 'Nanum Myeongjo', 'Noto Serif CJK KR', serif;
        font-weight: 800;
    }
    .jb-glyph-shine {
        fill: var(--jb-shine);
        stroke: none;
    }
    .jb-hint {
        fill: var(--jb-team);
        font-weight: 700;
        opacity: 0.85;
    }
    .jb-hit {
        cursor: pointer;
        outline: none;
    }
    .jb-hit:focus-visible {
        stroke: var(--jb-selected);
        stroke-width: 3;
    }
    /* 장군·멍군 알림 — 판 나무색 위에 흰 테를 두른 큰 글자 */
    .jb-flash {
        font-size: 92px;
        font-weight: 900;
        paint-order: stroke;
        stroke: rgba(255, 255, 255, 0.92);
        stroke-width: 10px;
        stroke-linejoin: round;
        pointer-events: none;
        transform-box: fill-box;
        transform-origin: center;
        animation: jb-flash 0.9s ease-out forwards;
    }
    .jb-flash-check {
        fill: var(--jb-check);
    }
    .jb-flash-block {
        fill: var(--jb-last);
    }
    @keyframes jb-flash {
        0% {
            opacity: 0;
            transform: scale(0.6);
        }
        20% {
            opacity: 1;
            transform: scale(1.08);
        }
        70% {
            opacity: 1;
            transform: scale(1);
        }
        100% {
            opacity: 0;
            transform: scale(1);
        }
    }
    .jb-banner {
        pointer-events: none;
        animation: jb-banner-in 0.35s ease-out;
    }
    .jb-banner-band {
        fill: rgba(20, 10, 0, 0.72);
    }
    .jb-banner-win .jb-banner-band {
        fill: rgba(127, 29, 29, 0.82);
    }
    .jb-banner-text {
        font-size: 40px;
        font-weight: 900;
        fill: #fff7e6;
    }
    @keyframes jb-banner-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    @keyframes jb-pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.35;
        }
    }
    @media (max-width: 420px) {
        .jb-hint {
            display: none;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .jb-piece,
        .jb-body,
        .jb-ground {
            transition: none;
        }
        .jb-lifted .jb-body,
        .jb-lifted .jb-ground {
            transform: none;
            opacity: 1;
        }
        .jb-check,
        .jb-flash,
        .jb-banner {
            animation: none;
        }
    }
</style>
