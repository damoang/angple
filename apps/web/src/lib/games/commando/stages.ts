/**
 * 다모앙 특공대 스테이지 데이터 — JSON 모양의 TS 값. DOM 없음.
 *
 * 좌표는 모두 타일 칸(16px). 지도는 위에서부터 줄(row), 왼쪽에서부터 열(col).
 * 화면(384×216)은 가로 24칸, 지도 높이는 14줄(224px) — 화면은 지도 아래쪽 216px 을 보여 준다.
 *
 * 확장 자리 (2·3단계)
 * - 적 종류: ENEMY_* 에 번호를 더하고 engine.ts 의 ENEMY_SPECS·updateEnemy 에 행동을 더한다.
 * - 스테이지: STAGES 에 더한다. 보스·포로·무기 상자도 같은 방식(칸 좌표 목록)으로 붙인다.
 */
import { T_CRATE, T_EMPTY, T_PLATFORM, T_SOLID, type TileMap } from './physics';

/** 적 종류 — 1단계 PR 1 은 표적병 하나 (보병·투척병·보스는 다음 PR) */
export const ENEMY_DUMMY = 1;

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
    /** 땅: [시작 열, 끝 열(포함), 맨 위 줄] — 그 줄부터 지도 바닥까지 채운다 */
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
     * 그때까지 나온 적을 모두 잡아야 다시 오른쪽으로 간다.
     */
    locks: number[];
    /** 출발 칸 (발 위치) */
    start: [number, number];
    /** 이 열에 닿으면 구간 끝 */
    goal: number;
}

/** 나무 상자 체력 (권총 1발 = 1) */
export const CRATE_HP = 3;

/**
 * 시험 구간 — 엔진·조작 확인용 짧은 길(화면 5개 분량).
 * 바닥은 12줄부터(지면 위 = y 192px). 점프 높이는 약 3칸이라 발판·바위는 3칸 이하로만 올라간다.
 */
export const TEST_STAGE: StageDef = {
    name: '훈련장',
    cols: 120,
    rows: 14,
    ground: [[0, 119, 12]],
    blocks: [
        [56, 10, 4, 2],
        [98, 10, 2, 2]
    ],
    platforms: [
        [18, 9, 4],
        [40, 9, 6],
        [74, 9, 5],
        [80, 6, 5]
    ],
    crates: [
        [14, 11],
        [30, 11],
        [31, 11],
        [31, 10],
        [64, 11],
        [65, 11],
        [90, 11],
        [91, 11],
        [91, 10],
        [92, 11]
    ],
    enemies: [
        { kind: ENEMY_DUMMY, col: 36, row: 11 },
        { kind: ENEMY_DUMMY, col: 43, row: 8 },
        { kind: ENEMY_DUMMY, col: 50, row: 11 },
        { kind: ENEMY_DUMMY, col: 70, row: 11 },
        { kind: ENEMY_DUMMY, col: 82, row: 5 },
        { kind: ENEMY_DUMMY, col: 96, row: 11 },
        { kind: ENEMY_DUMMY, col: 104, row: 11 },
        { kind: ENEMY_DUMMY, col: 108, row: 11 }
    ],
    locks: [30, 88],
    start: [3, 11],
    goal: 114
};

export const STAGES: StageDef[] = [TEST_STAGE];

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
