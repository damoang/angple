/**
 * 벽돌깨기 스테이지·벽돌·아이템·점수 표 — 숫자만 두는 곳(그리기·DOM 없음).
 *
 * 엔진(engine.ts)과, 2단계에서 서버가 다시 돌릴 같은 규칙이 이 표를 그대로 쓴다.
 * 값을 바꾸면 이미 남은 기록의 재연 결과가 달라지므로 규칙 변경으로 취급한다.
 */

/** 벽돌 종류 — 0 은 빈칸 */
export const BRICK_NONE = 0;
/** 일반 벽돌: 1번 맞으면 깨진다 */
export const BRICK_NORMAL = 1;
/** 단단한 벽돌: 2번 */
export const BRICK_HARD2 = 2;
/** 단단한 벽돌: 3번 */
export const BRICK_HARD3 = 3;
/** 안 깨지는 벽돌 — 튕기기만 하고 스테이지 클리어 조건에서 빠진다 */
export const BRICK_SOLID = 4;

/** 깨지는 벽돌인가 */
export function isBreakable(kind: number): boolean {
    return kind >= BRICK_NORMAL && kind <= BRICK_HARD3;
}

/** 벽돌 종류별 처음 내구도(맞아야 하는 횟수). 안 깨지는 벽돌은 0 */
export function brickHp(kind: number): number {
    return isBreakable(kind) ? kind : 0;
}

/**
 * 스테이지 배치 — 한 줄 10칸, 위에서부터. 줄 수는 10 이하.
 * '.' 빈칸 · '1' 일반 · '2' 2번 · '3' 3번 · '#' 안 깨짐
 */
export const STAGES: string[][] = [
    // 1. 줄무늬
    ['..........', '1111111111', '1111111111', '2222222222', '1111111111', '1111111111'],
    // 2. 하트
    [
        '.11....11.',
        '1221..1221',
        '1222112221',
        '1222222221',
        '.12222221.',
        '..122221..',
        '...1221...',
        '....11....'
    ],
    // 3. 탑 — 바닥 양옆에 안 깨지는 받침
    [
        '....33....',
        '...1221...',
        '..122221..',
        '.12211221.',
        '1221##1221',
        '11......11',
        '##......##'
    ],
    // 4. 바둑판 — 사이사이 안 깨지는 칸
    [
        '1.1.1.1.1.',
        '.2.2.2.2.2',
        '1.1.1.1.1.',
        '#.#.#..#.#',
        '.1.1.1.1.1',
        '2.2.2.2.2.',
        '.1.1.1.1.1'
    ],
    // 5. 성 — 단단한 성벽 안의 보물
    [
        '3333333333',
        '3........3',
        '3.111111.3',
        '3.122221.3',
        '3.111111.3',
        '3........3',
        '##.####.##'
    ]
];

/** 배치 문자 → 벽돌 종류 */
export function brickKindOf(ch: string): number {
    switch (ch) {
        case '1':
            return BRICK_NORMAL;
        case '2':
            return BRICK_HARD2;
        case '3':
            return BRICK_HARD3;
        case '#':
            return BRICK_SOLID;
        default:
            return BRICK_NONE;
    }
}

/* ── 아이템 ── */

/** 막대 넓게 */
export const ITEM_WIDE = 1;
/** 공 여러 개 */
export const ITEM_MULTI = 2;
/** 공 느리게 */
export const ITEM_SLOW = 3;
/** 목숨 +1 */
export const ITEM_LIFE = 4;

/** 깨진 벽돌에서 아이템이 떨어질 확률(%) */
export const DROP_PERCENT = 12;

/**
 * 아이템 종류 고르기 — r 은 0~99. 넓게 35 · 여러 개 30 · 느리게 25 · 목숨 10.
 */
export function itemKindFor(r: number): number {
    if (r < 35) return ITEM_WIDE;
    if (r < 65) return ITEM_MULTI;
    if (r < 90) return ITEM_SLOW;
    return ITEM_LIFE;
}

/* ── 점수 ── */

/** 깨졌을 때 점수 (종류별) */
export const BREAK_POINTS = [0, 10, 30, 50, 0];
/** 단단한 벽돌이 금만 갔을 때 점수 */
export const DAMAGE_POINTS = 5;
/** 아이템을 받았을 때 점수 */
export const ITEM_POINTS = 50;
/** 목숨이 이미 가득일 때 목숨 아이템 대신 주는 점수 */
export const FULL_LIFE_POINTS = 500;
/** 스테이지 클리어 보너스 (× 바퀴 수) */
export const STAGE_BONUS = 500;
/** 스테이지 클리어 때 남은 목숨 1개당 보너스 */
export const LIFE_BONUS = 100;
/**
 * 콤보 — 막대에 닿지 않고 연속으로 벽돌을 맞힌 수. 점수 × (4 + min(콤보, 8)) / 4,
 * 즉 첫 번째 ×1 에서 한 번에 0.25 씩 올라 최대 ×3.
 */
export const COMBO_DIV = 4;
export const COMBO_CAP = 8;

/**
 * 벽돌 한 번 맞힌 점수 — base 는 위 표의 값, combo 는 이번 타격 전까지 이어진 콤보,
 * loop 는 다섯 스테이지를 다 돈 횟수(돌 때마다 기본 점수가 1배씩 늘어난다). 정수 나눗셈은 버림.
 */
export function hitPoints(base: number, combo: number, loop: number): number {
    const c = combo < COMBO_CAP ? combo : COMBO_CAP;
    return Math.trunc((base * (1 + loop) * (COMBO_DIV + c)) / COMBO_DIV);
}
