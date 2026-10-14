/**
 * 앙 스트라이커 비행 경로 — 미리 정한 3차 베지어 곡선 표와 정수 계산.
 *
 * 경로 = 조각(segment) 여러 개. 한 조각 = [틱 수, x0, y0, x1, y1, x2, y2, x3, y3].
 * 엔진 안에서는 좌표를 고정소수점 단위(논리 px × 256)로 펴서 한 줄 배열에 이어 둔다:
 *   [틱, x0, y0, …, y3, 틱, x0, …] (조각마다 9칸)
 * 위치는 틱 t 마다 정수식으로만 구한다 — 부동소수점을 쓰지 않으므로 어느 기기·서버에서나 같다.
 *
 * ⚠ 재연 호환: 아래 표를 바꾸면 규칙 버전(stages.ts RULES_VERSION)을 올려야 한다.
 */

/** 한 조각의 칸 수 */
export const SEG_LEN = 9;

/** 정수 나눗셈 — 0 쪽으로 버림(Go 의 a / b 와 같다) */
export function idiv(a: number, b: number): number {
    return Math.trunc(a / b);
}

/**
 * 3차 베지어 한 축 — 점 a·b·c·d 에서 t/n 지점 (정수).
 * (n−t)³a + 3(n−t)²t·b + 3(n−t)t²·c + t³d 를 n³ 로 나눈다.
 * n ≤ 255, 좌표 절댓값 ≤ 2048 px × 256 이면 중간값이 2^53 보다 훨씬 작다.
 */
export function bezier(a: number, b: number, c: number, d: number, t: number, n: number): number {
    const u = n - t;
    const num = u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    return idiv(num, n * n * n);
}

/** 경로 전체 틱 수 */
export function pathTicks(path: readonly number[]): number {
    let n = 0;
    for (let i = 0; i < path.length; i += SEG_LEN) n += path[i];
    return n;
}

/** 경로의 틱 t 위치를 out[0], out[1] 에 쓴다 (t 가 끝을 넘으면 끝점) */
export function pathPoint(path: readonly number[], t: number, out: number[]): void {
    let i = 0;
    let rest = t;
    while (i + SEG_LEN < path.length && rest >= path[i]) {
        rest -= path[i];
        i += SEG_LEN;
    }
    const n = path[i];
    if (rest > n) rest = n;
    out[0] = bezier(path[i + 1], path[i + 3], path[i + 5], path[i + 7], rest, n);
    out[1] = bezier(path[i + 2], path[i + 4], path[i + 6], path[i + 8], rest, n);
}

/**
 * 표(논리 px) → 엔진 경로(단위). mirror 면 좌우를 뒤집고(x → width − x), (dx, dy) px 만큼 옮긴다.
 */
export function toPath(
    table: readonly number[],
    scale: number,
    width: number,
    mirror: boolean,
    dx = 0,
    dy = 0
): number[] {
    const out: number[] = [];
    for (let i = 0; i < table.length; i += SEG_LEN) {
        out.push(table[i]);
        for (let k = 0; k < 4; k++) {
            const x = table[i + 1 + k * 2];
            const y = table[i + 2 + k * 2];
            out.push(((mirror ? width - x : x) + dx) * scale, (y + dy) * scale);
        }
    }
    return out;
}

/**
 * 입장 경로(논리 px, 왼쪽에서 들어오는 모양 — 오른쪽 무리는 좌우를 뒤집어 쓴다).
 * 경로가 끝나면 적은 자기 편대 칸으로 곧장 날아가 자리 잡는다.
 */
export const ENTRY_PATHS: number[][] = [
    // 위 왼쪽에서 내려와 크게 돌아 올라간다
    [70, -20, -20, 120, 160, 40, 320, 130, 300, 50, 130, 300, 210, 280, 220, 180, 160, 150],
    // 옆에서 낮게 들어와 위로 감아 올라간다
    [80, -20, 430, 140, 410, 260, 300, 200, 210, 40, 200, 210, 160, 140, 100, 180, 130, 230],
    // 위 가운데 쪽에서 곧게 내려오다 고리를 그린다
    [70, 150, -20, 150, 120, 60, 240, 110, 280, 45, 110, 280, 160, 320, 230, 240, 180, 180]
];

/**
 * 보너스 스테이지 경로(논리 px) — 쏘지 않고 줄지어 화면을 가로질러 빠져나간다.
 * 끝점은 판 밖이다.
 */
export const BONUS_PATHS: number[][] = [
    // 왼쪽 위에서 아래로 처졌다가 오른쪽 위로 빠진다
    [150, -20, 120, 160, 520, 240, 520, 390, 100],
    // 위 가운데에서 S 자로 내려가 아래로 빠진다
    [170, 180, -20, -60, 300, 420, 360, 180, 700],
    // 옆으로 들어와 원을 반쯤 그리고 위로 빠진다
    [80, -20, 360, 120, 360, 260, 300, 260, 200, 80, 260, 200, 260, 100, 120, 40, 60, -40]
];

/** 급강하 첫 조각(제자리에서 옆으로 고리를 그리며 몸을 돌린다)의 틱 수 */
export const DIVE_LOOP_TICKS = 36;

/**
 * 급강하 경로(단위) — 출발 (sx, sy), 도는 쪽 side(−1 왼쪽 · 1 오른쪽), 노리는 x(ax),
 * 내려가는 조각 틱 수 n. 끝점은 판 아래 밖(y = bottom)이다.
 * 모양 표(px 오프셋)는 고정이고 출발점·노리는 x 만 판마다 다르다.
 */
export function divePath(
    sx: number,
    sy: number,
    side: number,
    ax: number,
    n: number,
    scale: number,
    bottom: number
): number[] {
    const S = scale;
    const lx = sx + side * 60 * S;
    const ly = sy + 40 * S;
    return [
        DIVE_LOOP_TICKS,
        sx,
        sy,
        sx + side * 30 * S,
        sy - 40 * S,
        sx + side * 70 * S,
        sy - 20 * S,
        lx,
        ly,
        n,
        lx,
        ly,
        sx + side * 40 * S,
        sy + 220 * S,
        ax,
        440 * S,
        ax - side * 40 * S,
        bottom
    ];
}

/** 경로의 모든 점을 (dx, dy) 단위만큼 옮긴 새 경로 (호위가 대장 옆을 따라 날 때) */
export function shiftPath(path: readonly number[], dx: number, dy: number): number[] {
    const out = path.slice();
    for (let i = 0; i < out.length; i += SEG_LEN) {
        for (let k = 0; k < 4; k++) {
            out[i + 1 + k * 2] += dx;
            out[i + 2 + k * 2] += dy;
        }
    }
    return out;
}
