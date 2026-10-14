/**
 * 다모앙 특공대 물리 — 고정소수점 정수, 타일 충돌. DOM 없음, 결정적.
 *
 * 약속
 * - 좌표·속도는 모두 정수(고정소수점: 논리 1px = SCALE 단위).
 * - 나눗셈은 idiv(0 쪽으로 버림)와 fdiv(아래로 버림, 타일 칸 번호용) 두 개뿐이다.
 *   fdiv 의 나누는 수는 2의 거듭제곱(TILE_U = 4096)이라 부동소수점 나눗셈 결과가 정확하다.
 * - 몸통은 축에 나란한 사각형(왼쪽 위 x·y, 너비 w·높이 h, 모두 단위).
 * - 한 틱 이동 거리는 타일 한 칸(16px)보다 작다(최대 낙하 속도 6px). 그래서 「도착한 자리의 앞 가장자리」
 *   한 줄만 보면 벽·바닥을 건너뛰지 않는다(바닥 뚫림 없음).
 *
 * 타일
 * - T_SOLID(땅·바위)·T_CRATE(나무 상자): 사방이 막힌다. 총알도 막는다.
 * - T_PLATFORM(발판): 위에서 내려올 때만 선다(아래·옆에서는 통과). 총알은 통과.
 * - 지도 왼쪽·오른쪽 밖은 벽, 위는 빈칸, 아래는 구덩이(빈칸 — 떨어지면 엔진이 처리).
 */

/** 논리 1px 의 고정소수점 단위 */
export const SCALE = 256;
/** 타일 한 변(px) */
export const TILE = 16;
/** 타일 한 변(단위) */
export const TILE_U = TILE * SCALE;

export const T_EMPTY = 0;
export const T_SOLID = 1;
export const T_PLATFORM = 2;
export const T_CRATE = 3;

/** 정수 나눗셈 — 0 쪽으로 버림 (Go 의 정수 나눗셈과 같다) */
export function idiv(a: number, b: number): number {
    return Math.trunc(a / b);
}

/** 타일 칸 번호 — 아래로 버림 (음수 좌표도 바른 칸) */
export function fdiv(a: number, b: number): number {
    return Math.floor(a / b);
}

export function clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v;
}

/**
 * mulberry32 — 32비트 정수 연산만 쓰는 작은 난수기. [다음 상태, 값(uint32)] 을 돌려준다.
 */
export function mulberry32(state: number): [number, number] {
    const s = (state + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return [s, (t ^ (t >>> 14)) >>> 0];
}

export interface TileMap {
    cols: number;
    rows: number;
    /** 줄 우선(row * cols + col) 타일 종류 */
    tiles: number[];
}

/** 칸의 타일 — 왼쪽·오른쪽 밖은 벽, 위·아래 밖은 빈칸 */
export function tileAt(map: TileMap, col: number, row: number): number {
    if (col < 0 || col >= map.cols) return T_SOLID;
    if (row < 0 || row >= map.rows) return T_EMPTY;
    return map.tiles[row * map.cols + col];
}

/** 사방이 막힌 타일인가 (땅·상자) */
export function isSolid(t: number): boolean {
    return t === T_SOLID || t === T_CRATE;
}

/** 단위 좌표 한 점이 막힌 타일 안인가 */
export function solidAt(map: TileMap, x: number, y: number): boolean {
    return isSolid(tileAt(map, fdiv(x, TILE_U), fdiv(y, TILE_U)));
}

/** 사각형(왼쪽 위 x·y, 너비 w·높이 h)이 막힌 타일과 겹치는가 */
export function boxHitsSolid(map: TileMap, x: number, y: number, w: number, h: number): boolean {
    const c0 = fdiv(x, TILE_U);
    const c1 = fdiv(x + w - 1, TILE_U);
    const r0 = fdiv(y, TILE_U);
    const r1 = fdiv(y + h - 1, TILE_U);
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            if (isSolid(tileAt(map, c, r))) return true;
        }
    }
    return false;
}

export interface Body {
    /** 왼쪽 위 (단위) */
    x: number;
    y: number;
    /** 너비·높이 (단위) */
    w: number;
    h: number;
    vx: number;
    vy: number;
    onGround: boolean;
}

/**
 * 가로 이동. 벽에 막히면 벽면에 딱 붙여 세우고 true.
 * |dx| < TILE_U 라서 앞 가장자리가 새로 들어간 열 하나만 보면 된다.
 */
export function moveX(map: TileMap, b: Body, dx: number): boolean {
    if (dx === 0) return false;
    const nx = b.x + dx;
    const r0 = fdiv(b.y, TILE_U);
    const r1 = fdiv(b.y + b.h - 1, TILE_U);
    const col = dx > 0 ? fdiv(nx + b.w - 1, TILE_U) : fdiv(nx, TILE_U);
    for (let r = r0; r <= r1; r++) {
        if (isSolid(tileAt(map, col, r))) {
            b.x = dx > 0 ? col * TILE_U - b.w : (col + 1) * TILE_U;
            b.vx = 0;
            return true;
        }
    }
    b.x = nx;
    return false;
}

/**
 * 세로 이동. 내려가다 바닥(또는 위에서 밟은 발판)에 닿으면 그 위에 세우고 onGround.
 * 올라가다 천장에 닿으면 천장 아래에 붙이고 속도 0.
 * drop = 발판을 무시하고 내려간다(엎드려 점프로 발판 아래로 내려가기).
 * 반환: 무엇에든 막혔는가.
 */
export function moveY(map: TileMap, b: Body, dy: number, drop = false): boolean {
    b.onGround = false;
    if (dy === 0) return false;
    const c0 = fdiv(b.x, TILE_U);
    const c1 = fdiv(b.x + b.w - 1, TILE_U);
    if (dy > 0) {
        const oldRow = fdiv(b.y + b.h - 1, TILE_U);
        const row = fdiv(b.y + b.h - 1 + dy, TILE_U);
        for (let c = c0; c <= c1; c++) {
            const t = tileAt(map, c, row);
            // 발판은 「이번 틱에 위쪽 줄에서 그 줄로 넘어온」 경우에만 선다 (한쪽 방향 발판)
            if (isSolid(t) || (t === T_PLATFORM && !drop && oldRow < row)) {
                b.y = row * TILE_U - b.h;
                b.vy = 0;
                b.onGround = true;
                return true;
            }
        }
    } else {
        const row = fdiv(b.y + dy, TILE_U);
        for (let c = c0; c <= c1; c++) {
            if (isSolid(tileAt(map, c, row))) {
                b.y = (row + 1) * TILE_U;
                b.vy = 0;
                return true;
            }
        }
    }
    b.y += dy;
    return false;
}

/** 몸통 바로 아래가 발판뿐인가 (땅·상자 없이) — 엎드려 점프로 내려갈 수 있는 자리 */
export function onPlatformOnly(map: TileMap, b: Body): boolean {
    const row = fdiv(b.y + b.h, TILE_U);
    const c0 = fdiv(b.x, TILE_U);
    const c1 = fdiv(b.x + b.w - 1, TILE_U);
    let platform = false;
    for (let c = c0; c <= c1; c++) {
        const t = tileAt(map, c, row);
        if (isSolid(t)) return false;
        if (t === T_PLATFORM) platform = true;
    }
    return platform;
}

/** 두 사각형(왼쪽 위·너비·높이)이 겹치는가 — 가장자리에 딱 닿은 것은 겹침이 아니다 */
export function boxesOverlap(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
