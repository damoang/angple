/**
 * 앙 스트라이커 편대·점수·난이도 표 — 숫자만 두는 곳(그리기·DOM 없음).
 *
 * 엔진(engine.ts)과, 2단계에서 서버가 다시 돌릴 같은 규칙이 이 표를 그대로 쓴다.
 *
 * ⚠ 재연 호환을 위해 이 파일의 표(편대·확률·점수·난이도)와 engine.ts·paths.ts 의 상수는 고정이다.
 * 하나라도 바꾸면 이미 남은 기록의 재연 결과가 달라지므로, 규칙 버전을 올리고
 * 서버 쪽 규칙·공용 테스트 벡터를 같이 바꿔야 한다.
 */

/** 규칙 버전 — 위 「고정」 규칙을 바꿀 때마다 1씩 올린다 */
export const RULES_VERSION = 1;

/** 적 종류 */
export const ENEMY_GRUNT = 1;
export const ENEMY_MID = 2;
export const ENEMY_BOSS = 3;

/** 종류별 내구도(맞아야 하는 횟수) — 대장은 2번 (한 번 맞으면 색이 바뀐다) */
export function enemyHp(kind: number): number {
    return kind === ENEMY_BOSS ? 2 : 1;
}

/** 편대 칸 수 — 한 줄 10칸 × 5줄 = 40 (동시 적 상한과 같다) */
export const FORM_COLS = 10;
export const FORM_ROWS = 5;
/** 편대 칸 위치(논리 px): x = FORM_LEFT + 칸 × FORM_DX (+ 흔들림), y = FORM_TOP + 줄 × FORM_DY */
export const FORM_LEFT = 36;
export const FORM_DX = 32;
export const FORM_TOP = 72;
export const FORM_DY = 28;

/**
 * 편대 배치 — 한 줄 10칸, 위에서부터 5줄. 'B' 대장 · 'M' 중간 · 'G' 졸개 · '.' 빈칸.
 * 일반 스테이지 k 번째(0부터)는 LAYOUTS[min(k, 마지막)] 을 쓴다.
 */
export const LAYOUTS: string[][] = [
    // 1스테이지 — 26마리
    ['....BB....', '..MMMMMM..', '...MMMM...', '.GGGGGGGG.', '..GGGGGG..'],
    // 2스테이지 — 36마리
    ['...BBBB...', '..MMMMMM..', '.MMMMMMMM.', '.GGGGGGGG.', 'GGGGGGGGGG'],
    // 4스테이지부터 — 40마리
    ['...BBBB...', '.MMMMMMMM.', '.MMMMMMMM.', 'GGGGGGGGGG', 'GGGGGGGGGG']
];

/** 배치 글자 → 적 종류 (0 = 빈칸) */
export function enemyKindOf(ch: string): number {
    if (ch === 'B') return ENEMY_BOSS;
    if (ch === 'M') return ENEMY_MID;
    if (ch === 'G') return ENEMY_GRUNT;
    return 0;
}

/** 스테이지 번호(1부터)가 보너스 스테이지인가 — 3스테이지마다 */
export function isBonusStage(stageNo: number): boolean {
    return stageNo % 3 === 0;
}

/* ── 점수 ── */

/** 편대(또는 입장·복귀 중)에 있을 때 맞혀 떨어뜨린 점수 */
export const FORM_POINTS: Record<number, number> = {
    [ENEMY_GRUNT]: 50,
    [ENEMY_MID]: 80,
    [ENEMY_BOSS]: 150
};
/** 급강하 중에 맞혀 떨어뜨린 점수 (편대보다 크다) */
export const DIVE_POINTS: Record<number, number> = {
    [ENEMY_GRUNT]: 100,
    [ENEMY_MID]: 160,
    [ENEMY_BOSS]: 400
};
/** 대장과 호위를 같은 급강하 안에서 모두 맞혀 떨어뜨리면 — 호위 수(1·2)별 추가 점수 */
export const SQUAD_BONUS = [0, 800, 1600];
/** 보너스 스테이지: 한 마리당, 모두 맞히면(퍼펙트) 끝 보너스 대신 이 점수 */
export const BONUS_HIT_POINTS = 100;
export const BONUS_PERFECT = 10000;
/** 아이템을 받았을 때 */
export const ITEM_POINTS = 200;

/** 목숨 +1 점수(차례대로) */
export const EXTEND_AT = [20000, 70000];

/* ── 아이템 ── */

/** 연사 강화: 한동안 더 빠르게·더 많이 쏜다 */
export const ITEM_RAPID = 1;
/** 방패: 한 번 맞아도 버틴다 */
export const ITEM_SHIELD = 2;
/** 대장을 떨어뜨렸을 때 아이템이 떨어질 확률(%) */
export const DROP_PERCENT = 35;

/** 난수(0~99) → 아이템 종류 */
export function itemKindFor(roll: number): number {
    return roll < 50 ? ITEM_RAPID : ITEM_SHIELD;
}

/* ── 난이도 — level = 지금까지 깬 일반 스테이지 수(0부터) ── */

/** 급강하 사이 간격(틱) */
export function diveInterval(level: number): number {
    return Math.max(60, 150 - level * 12);
}

/** 동시에 급강하·복귀 중일 수 있는 적 수 */
export function maxDivers(level: number): number {
    return Math.min(8, 2 + level);
}

/** 급강하 두 번째 구간(내려가는 곡선)의 틱 수 — 작을수록 빠르다 */
export function diveTicks(level: number): number {
    return Math.max(84, 160 - level * 8);
}

/** 적 총알 속력(논리 px × 256 / 틱) — 3px 에서 시작해 5px 까지 */
export function bulletSpeed(level: number): number {
    return Math.min(5 * 256, 3 * 256 + level * 40);
}

/** 급강하하는 적이 한 발 쏠 확률(%) */
export function fireChance(level: number): number {
    return Math.min(100, 50 + level * 10);
}

/** 한 발을 쏜 뒤 두 번째 발을 쏠 확률(%) — 3스테이지 전까지는 없다 */
export function secondShotChance(level: number): number {
    return level < 2 ? 0 : Math.min(80, (level - 1) * 20);
}
