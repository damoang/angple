/**
 * 앙쌓기 캔버스 그리기 — 판·조각·다음 조각. 게임 상태를 바꾸지 않는 순수 그리기 함수만 둔다.
 *
 * 혼자하기(stack-game)와 대전(stack-online)이 같이 쓴다. 대전에서는 상대 판을 서버가 보낸
 * 162자 문자열('0'~'8')로 받으므로, 판은 숫자 배열과 문자열을 모두 받는다.
 */
import { COLS, ROWS, SHAPES, GARBAGE, type Piece } from './engine';

/** 조각별 색 — 자체 팔레트(밝은/어두운 테마 모두에서 보이는 중간 채도) */
export const PALETTE = [
    '#e8836b',
    '#3fa7a0',
    '#d9a441',
    '#c76aa6',
    '#5b8fd9',
    '#8fb65a',
    '#9a7fd1'
];
/** 방해 줄 칸 색 */
export const GARBAGE_COLOR = '#8a8f98';

/** roundRect 가 없는 브라우저(iOS 15 등)에서는 각진 사각형으로 그린다 */
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
}

/**
 * 칸 하나: 둥근 타일 + 왼쪽 위 작은 광택 + 조각별 무늬(색만으로 구분하지 않게).
 * kind 0~6 은 조각, GARBAGE-1(7) 은 방해 줄(회색, 가운데 작은 점).
 */
export function tile(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: number) {
    const pad = Math.max(1, s * 0.06);
    const size = s - pad * 2;
    ctx.fillStyle = PALETTE[kind] ?? GARBAGE_COLOR;
    ctx.beginPath();
    roundRect(ctx, x + pad, y + pad, size, size, size * 0.24);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    roundRect(ctx, x + pad * 2.5, y + pad * 2.5, size * 0.32, size * 0.14, size * 0.07);
    ctx.fill();

    const cx = x + s / 2;
    const cy = y + s / 2 + s * 0.04;
    const m = s * 0.16;
    ctx.strokeStyle = ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    switch (kind) {
        case 0: // 가로 줄
            ctx.moveTo(cx - m, cy);
            ctx.lineTo(cx + m, cy);
            break;
        case 1: // 작은 네모
            ctx.rect(cx - m * 0.7, cy - m * 0.7, m * 1.4, m * 1.4);
            ctx.fill();
            return;
        case 2: // 점
            ctx.arc(cx, cy, m * 0.75, 0, Math.PI * 2);
            ctx.fill();
            return;
        case 3: // 빗금 /
            ctx.moveTo(cx - m, cy + m);
            ctx.lineTo(cx + m, cy - m);
            break;
        case 4: // 빗금 \
            ctx.moveTo(cx - m, cy - m);
            ctx.lineTo(cx + m, cy + m);
            break;
        case 5: // 고리
            ctx.arc(cx, cy, m, 0, Math.PI * 2);
            break;
        case GARBAGE - 1: // 방해 줄 — 작은 점
            ctx.arc(cx, cy, m * 0.4, 0, Math.PI * 2);
            ctx.fill();
            return;
        default: // 더하기
            ctx.moveTo(cx - m, cy);
            ctx.lineTo(cx + m, cy);
            ctx.moveTo(cx, cy - m);
            ctx.lineTo(cx, cy + m);
    }
    ctx.stroke();
}

/** 판의 i 번째 칸 값(0=빈칸, 1~7 조각, 8 방해 줄). 문자열 판은 '0'~'8' */
function cellAt(board: readonly number[] | string, i: number): number {
    if (typeof board === 'string') {
        const v = board.charCodeAt(i) - 48;
        return v >= 0 && v <= 8 ? v : 0;
    }
    return board[i] ?? 0;
}

export interface DrawBoardOptions {
    /** 그릴 너비(CSS px). 없으면 cell × COLS */
    width?: number;
    /** 그릴 높이(CSS px). 없으면 cell × ROWS */
    height?: number;
    /** 격자 선 색. 없으면 격자를 그리지 않는다 */
    grid?: string | null;
    /** 떨어지는 중인 조각. 없으면 그리지 않는다 */
    piece?: Piece | null;
}

/**
 * 판 전체를 그린다. board 는 엔진의 숫자 배열(ROWS×COLS) 또는 162자 문자열.
 * 문자열 길이가 맞지 않으면(상대가 아직 한 번도 굳히지 않은 "" 등) 빈 판으로 그린다.
 */
export function drawBoard(
    ctx: CanvasRenderingContext2D,
    board: readonly number[] | string,
    cell: number,
    opts: DrawBoardOptions = {}
) {
    const w = opts.width ?? cell * COLS;
    const h = opts.height ?? cell * ROWS;
    const s = cell;
    ctx.clearRect(0, 0, w, h);

    if (opts.grid) {
        ctx.strokeStyle = opts.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 1; c < COLS; c++) {
            ctx.moveTo(Math.round(c * s) + 0.5, 0);
            ctx.lineTo(Math.round(c * s) + 0.5, h);
        }
        for (let r = 1; r < ROWS; r++) {
            ctx.moveTo(0, Math.round(r * s) + 0.5);
            ctx.lineTo(w, Math.round(r * s) + 0.5);
        }
        ctx.stroke();
    }

    const n = COLS * ROWS;
    const valid = typeof board !== 'string' || board.length === n;
    if (valid) {
        for (let i = 0; i < n; i++) {
            const v = cellAt(board, i);
            if (v) tile(ctx, (i % COLS) * s, Math.floor(i / COLS) * s, s, v - 1);
        }
    }
    const p = opts.piece;
    if (!p) return;
    for (const [cx, cy] of SHAPES[p.kind][p.rot]) {
        if (p.y + cy >= 0) tile(ctx, (p.x + cx) * s, (p.y + cy) * s, s, p.kind);
    }
}

/** 다음 조각 미리보기. kind 가 null 이면 비운다 */
export function drawNext(ctx: CanvasRenderingContext2D, w: number, h: number, kind: number | null) {
    ctx.clearRect(0, 0, w, h);
    if (kind === null) return;
    const cells = SHAPES[kind][0];
    const xs = cells.map((c) => c[0]);
    const ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const cw = Math.max(...xs) - minX + 1;
    const ch = Math.max(...ys) - minY + 1;
    const s = w / 4.5;
    const ox = (w - cw * s) / 2;
    const oy = (w - ch * s) / 2;
    for (const [x, y] of cells) tile(ctx, ox + (x - minX) * s, oy + (y - minY) * s, s, kind);
}
