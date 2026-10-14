/**
 * 다모앙 특공대 스테이지 데이터 — JSON 모양의 TS 값. DOM 없음.
 *
 * 좌표는 모두 타일 칸(16px). 지도는 위에서부터 줄(row), 왼쪽에서부터 열(col).
 * 화면(384×216)은 가로 24칸, 지도 높이는 14줄(224px) — 화면은 지도 아래쪽 216px 을 보여 준다.
 *
 * 확장 자리 (2·3단계)
 * - 적 종류: ENEMY_* 에 번호를 더하고 engine.ts 의 ENEMY_SPECS(·필요하면 updateEnemy)에 행동을 더한다.
 * - 스테이지: STAGES 에 더한다. 보스·포로·무기 상자도 같은 방식(칸 좌표 목록)으로 붙인다.
 */
import { T_CRATE, T_EMPTY, T_PLATFORM, T_SOLID, type TileMap } from './physics';

/** 적 종류 — 표적병(제자리, 시험용), 보병(걷다가 멈춰 쏜다), 투척병(수류탄을 던진다). 보스는 다음 PR */
export const ENEMY_DUMMY = 1;
export const ENEMY_RIFLE = 2;
export const ENEMY_THROWER = 3;

export interface EnemySpawn {
    kind: number;
    /** 서 있는 칸 (발이 이 칸 아래 가장자리에 닿는다) */
    col: number;
    row: number;
}

export interface StageDef {
    /** 화면에 보이는 이름 */
    name: string;
    cols: number;
    rows: number;
    /** 땅: [시작 열, 끝 열(포함), 맨 위 줄] — 그 줄부터 지도 바닥까지 채운다. 땅이 없는 열은 구덩이 */
    ground: [number, number, number][];
    /** 바위 덩어리: [열, 줄, 너비, 높이] */
    blocks: [number, number, number, number][];
    /** 발판: [열, 줄, 길이] */
    platforms: [number, number, number][];
    /** 나무 상자: [열, 줄] */
    crates: [number, number][];
    enemies: EnemySpawn[];
    /**
     * 잠금 구간 — 화면 왼쪽 가장자리가 이 열에 오면 카메라가 멈추고,
     * 그 화면(24칸) 안의 적을 모두 잡아야 다시 오른쪽으로 간다.
     */
    locks: number[];
    /** 출발 칸 (발 위치) */
    start: [number, number];
    /** 이 열에 닿으면 구간 끝 */
    goal: number;
}

/** 나무 상자 체력 (권총 1발 = 1) */
export const CRATE_HP = 3;

const R = ENEMY_RIFLE;
const T = ENEMY_THROWER;

/** [종류, 열, 줄] 목록 → 적 배치 */
function place(list: [number, number, number][]): EnemySpawn[] {
    return list.map(([kind, col, row]) => ({ kind, col, row }));
}

/**
 * 1단계 「강변 기지」 — 화면 13개 남짓(320칸). 바닥은 대개 12줄(지면 위 = y 192px).
 * 점프 높이는 약 3칸이라 턱은 2칸 이하, 바위는 2칸, 구덩이는 2칸 폭.
 *
 * 흐름(적은 조금씩 늘어난다): 들머리(보병 둘) → 잠금 A(보병 셋·투척병 하나, 상자 엄폐) → 언덕·구덩이 →
 * 잠금 B(높은 발판의 투척병) → 오르막 → 잠금 C → 다리 놓인 구덩이 → 잠금 D → 마지막 잠금 E → 깃발.
 * 보스 구역은 다음 PR 에서 깃발 자리에 붙는다.
 */
export const STAGE_1: StageDef = {
    name: '1단계 · 강변 기지',
    cols: 320,
    rows: 14,
    ground: [
        [0, 69, 12],
        [70, 85, 11],
        [86, 93, 12],
        // 턱에서 내려와 구덩이까지 8칸 평지
        // 94~95 구덩이
        [96, 139, 12],
        [140, 159, 11],
        [160, 167, 10],
        [168, 199, 12],
        // 200~201 구덩이 (위에 발판 다리)
        [202, 319, 12]
    ],
    blocks: [
        [36, 10, 2, 2],
        [126, 10, 3, 2],
        [214, 10, 2, 2],
        [266, 10, 2, 2]
    ],
    platforms: [
        [50, 9, 6],
        [76, 8, 5],
        [104, 9, 5],
        [112, 6, 4],
        [176, 9, 6],
        [196, 9, 8],
        [246, 9, 5],
        [284, 9, 6]
    ],
    crates: [
        [14, 11],
        [45, 11],
        [46, 11],
        [46, 10],
        [84, 10],
        [106, 11],
        [107, 11],
        [150, 10],
        [182, 11],
        [183, 11],
        [183, 10],
        [222, 11],
        [252, 11],
        [253, 11],
        [276, 11],
        [290, 11],
        [291, 11]
    ],
    enemies: place([
        // 들머리
        [R, 24, 11],
        [R, 33, 11],
        // 잠금 A (40~63)
        [R, 50, 11],
        [R, 52, 8],
        [T, 58, 11],
        [R, 61, 11],
        // 언덕·첫 구덩이
        [R, 72, 10],
        [T, 80, 7],
        [R, 88, 11],
        [R, 98, 11],
        // 잠금 B (100~123)
        [R, 105, 8],
        [R, 110, 11],
        [T, 113, 5],
        [T, 118, 11],
        [R, 121, 11],
        // 오르막
        [R, 132, 11],
        [T, 138, 11],
        [R, 146, 10],
        [R, 155, 10],
        [T, 164, 9],
        // 잠금 C (170~193)
        [R, 174, 11],
        [R, 178, 8],
        [T, 186, 11],
        [R, 188, 11],
        [T, 192, 11],
        // 다리 놓인 구덩이
        [R, 204, 11],
        [T, 212, 11],
        [R, 220, 11],
        [R, 228, 11],
        [T, 236, 11],
        // 잠금 D (240~263)
        [R, 244, 11],
        [R, 248, 8],
        [T, 256, 11],
        [R, 260, 11],
        [T, 262, 11],
        // 마지막 오르막
        [R, 268, 11],
        [T, 274, 11],
        [R, 282, 11],
        // 잠금 E (286~309)
        [R, 289, 8],
        [R, 294, 11],
        [T, 298, 11],
        [R, 302, 11],
        [T, 306, 11],
        [R, 308, 11]
    ]),
    locks: [40, 100, 170, 240, 286],
    start: [3, 11],
    goal: 312
};

/** 스테이지 목록 — 번호(0부터)가 재연(replay)·createGame 의 스테이지 번호 */
export const STAGES: StageDef[] = [STAGE_1];

/** 스테이지 정의로 타일 지도를 만든다 (상자 체력 표 함께) */
export function buildMap(def: StageDef): { map: TileMap; crateHp: number[] } {
    const tiles: number[] = new Array(def.cols * def.rows).fill(T_EMPTY);
    const crateHp: number[] = new Array(def.cols * def.rows).fill(0);
    const set = (c: number, r: number, t: number) => {
        if (c < 0 || c >= def.cols || r < 0 || r >= def.rows) return;
        tiles[r * def.cols + c] = t;
    };
    for (const [c0, c1, top] of def.ground) {
        for (let c = c0; c <= c1; c++) for (let r = top; r < def.rows; r++) set(c, r, T_SOLID);
    }
    for (const [c, r, w, h] of def.blocks) {
        for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) set(x, y, T_SOLID);
    }
    for (const [c, r, len] of def.platforms) {
        for (let x = c; x < c + len; x++) set(x, r, T_PLATFORM);
    }
    for (const [c, r] of def.crates) {
        set(c, r, T_CRATE);
        if (c >= 0 && c < def.cols && r >= 0 && r < def.rows) crateHp[r * def.cols + c] = CRATE_HP;
    }
    return { map: { cols: def.cols, rows: def.rows, tiles }, crateHp };
}
