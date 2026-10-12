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

    interface Props {
        pieces: JanggiPiece[];
        selected?: Point | null;
        targets?: Point[];
        lastMove?: { from: Point; to: Point } | null;
        /** 장군 받는 진영(그 궁에 빨간 테) */
        checkTeam?: number | null;
        interactive?: boolean;
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

    // 크기: 궁 > 차·포·마·상 > 사·졸
    const RADIUS: Record<number, number> = { 3: 27.5, 2: 23, 1: 18 };
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

    // 전통 장기판 귀점(포·졸 자리)
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
    role="group"
    aria-label={label}
>
    <defs>
        <linearGradient id="{uid}-wood" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color: var(--jb-wood-a)" />
            <stop offset="0.55" style="stop-color: var(--jb-wood-b)" />
            <stop offset="1" style="stop-color: var(--jb-wood-c)" />
        </linearGradient>
        <filter id="{uid}-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
                type="fractalNoise"
                baseFrequency="0.008 0.16"
                numOctaves="2"
                seed="11"
                result="noise"
            />
            <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0.32  0 0 0 0 0.18  0 0 0 0 0.05  0 0 0 0.5 -0.12"
            />
            <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <radialGradient id="{uid}-face" cx="0.35" cy="0.3" r="0.9">
            <stop offset="0" style="stop-color: var(--jb-face-a)" />
            <stop offset="1" style="stop-color: var(--jb-face-b)" />
        </radialGradient>
    </defs>

    <!-- 판 -->
    <rect width={W} height={H} rx="14" fill="url(#{uid}-wood)" />
    <rect width={W} height={H} rx="14" fill="#000" filter="url(#{uid}-grain)" />
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
    {#each POINT_MARKS as [mx, my] (mx + '-' + my)}
        <circle cx={px(mx)} cy={py(my)} r="2.8" class="jb-mark" />
    {/each}
    <text x={px(2)} y={py(4.5)} class="jb-river jb-river-cho">楚 河</text>
    <text x={px(6)} y={py(4.5)} class="jb-river jb-river-han">漢 界</text>

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
            <g
                class="jb-piece {p.team === TEAM.CHO ? 'jb-cho' : 'jb-han'}"
                style="transform: translate({px(p.x)}px, {py(p.y)}px)"
                aria-hidden="true"
            >
                <polygon points={OCT[rank]} class="jb-shadow" transform="translate(0 2.5)" />
                <polygon
                    points={OCT[rank]}
                    fill="url(#{uid}-face)"
                    class="jb-edge"
                    stroke-width="2.2"
                />
                <polygon
                    points={OCT_INNER[rank]}
                    fill="none"
                    class="jb-edge"
                    stroke-width="0.9"
                    opacity="0.55"
                />
                <text
                    y={-RADIUS[rank] * 0.12}
                    font-size={FONT[rank]}
                    class="jb-glyph"
                    text-anchor="middle"
                    dominant-baseline="central">{glyph[0]}</text
                >
                <text
                    y={RADIUS[rank] * 0.62}
                    font-size={HINT_FONT[rank]}
                    class="jb-hint"
                    text-anchor="middle"
                    dominant-baseline="central">{glyph[1]}</text
                >
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
        --jb-wood-a: #efcf98;
        --jb-wood-b: #dcb174;
        --jb-wood-c: #c99a5b;
        --jb-line: #5b3a1a;
        --jb-face-a: #fffaf0;
        --jb-face-b: #e9d6ae;
        --jb-cho: #0b6b55;
        --jb-han: #b42318;
        --jb-shadow: rgba(40, 20, 0, 0.32);
        --jb-selected: #d97706;
        --jb-target: #0f766e;
        --jb-last: #2563eb;
        --jb-check: #dc2626;
        border-radius: 14px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    }
    :global(.dark) .jb,
    :global(.amoled) .jb {
        --jb-wood-a: #b48a52;
        --jb-wood-b: #9a7240;
        --jb-wood-c: #7e5a30;
        --jb-line: #2b1a08;
        --jb-face-a: #f6ecd6;
        --jb-face-b: #d9c296;
        --jb-shadow: rgba(0, 0, 0, 0.55);
        --jb-selected: #fbbf24;
        --jb-target: #115e59;
        --jb-last: #1d4ed8;
        --jb-check: #ef4444;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
    }
    .jb-line {
        stroke: var(--jb-line);
        stroke-width: 1.2;
    }
    .jb-mark {
        fill: var(--jb-line);
        opacity: 0.55;
    }
    .jb-river {
        font-family: 'Noto Serif KR', 'Nanum Myeongjo', serif;
        font-size: 22px;
        font-weight: 700;
        text-anchor: middle;
        dominant-baseline: central;
        opacity: 0.28;
        letter-spacing: 0.6em;
    }
    .jb-river-cho {
        fill: var(--jb-cho);
    }
    .jb-river-han {
        fill: var(--jb-han);
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
    .jb-shadow {
        fill: var(--jb-shadow);
    }
    .jb-cho {
        --jb-team: var(--jb-cho);
    }
    .jb-han {
        --jb-team: var(--jb-han);
    }
    .jb-edge {
        stroke: var(--jb-team);
    }
    .jb-glyph {
        fill: var(--jb-team);
        font-family: 'Noto Serif KR', 'Nanum Myeongjo', 'Noto Serif CJK KR', serif;
        font-weight: 800;
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
        .jb-piece {
            transition: none;
        }
        .jb-check {
            animation: none;
        }
    }
</style>
