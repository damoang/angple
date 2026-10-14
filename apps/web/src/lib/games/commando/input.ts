/**
 * 다모앙 특공대 입력 — 버튼 7개를 한 틱의 비트 묶음(0~127)으로 나타낸다. DOM 없음.
 *
 * 엔진은 틱마다 이 묶음 하나만 받는다. 「누른 순간」(점프·수류탄)은 엔진이 직전 틱 묶음과 비교해 알아낸다.
 * 그래서 입력 기록은 「묶음이 바뀐 틱」만 [틱, 묶음, 틱, 묶음, …] 으로 남기면 판 전체가 재연된다.
 */

export const BTN_LEFT = 1;
export const BTN_RIGHT = 2;
export const BTN_UP = 4;
export const BTN_DOWN = 8;
export const BTN_FIRE = 16;
export const BTN_JUMP = 32;
export const BTN_GRENADE = 64;
/** 모든 버튼 비트 */
export const BTN_ALL = 127;
export const BTN_DIRS = BTN_LEFT | BTN_RIGHT | BTN_UP | BTN_DOWN;

/**
 * 키보드 — KeyboardEvent.code → 버튼 (code 를 쓰는 이유: 한글 자판에서는 key 가 'ㅋ' 처럼 바뀐다).
 * ←→ 이동, ↓ 엎드리기, ↑ 위 조준, Z/J 사격, X/K 점프, C/L 수류탄.
 */
export const KEYMAP: Record<string, number> = {
    ArrowLeft: BTN_LEFT,
    ArrowRight: BTN_RIGHT,
    ArrowUp: BTN_UP,
    ArrowDown: BTN_DOWN,
    KeyZ: BTN_FIRE,
    KeyJ: BTN_FIRE,
    KeyX: BTN_JUMP,
    KeyK: BTN_JUMP,
    KeyC: BTN_GRENADE,
    KeyL: BTN_GRENADE
};

/** 반대 방향을 함께 누르면 둘 다 없는 것으로 친다 (← + → = 멈춤, ↑ + ↓ = 없음) */
export function normalizeMask(mask: number): number {
    let m = mask & BTN_ALL;
    if ((m & (BTN_LEFT | BTN_RIGHT)) === (BTN_LEFT | BTN_RIGHT)) m &= ~(BTN_LEFT | BTN_RIGHT);
    if ((m & (BTN_UP | BTN_DOWN)) === (BTN_UP | BTN_DOWN)) m &= ~(BTN_UP | BTN_DOWN);
    return m;
}

/**
 * 가상 방향 패드 — 패드 가운데에서 손가락까지의 거리(dx·dy, 화면 px, 아래가 +)를 8방향 비트로.
 * dead 보다 가까우면 없음. 각 축은 그 축 성분이 다른 축의 tan(22.5°)≈0.414 배보다 클 때만 켜진다
 * → 45° 씩 나뉜 8방향. (정수만: 0.414 ≈ 53/128)
 */
export function padBits(dx: number, dy: number, dead: number): number {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax * ax + ay * ay < dead * dead) return 0;
    let bits = 0;
    if (ax * 128 > ay * 53) bits |= dx < 0 ? BTN_LEFT : BTN_RIGHT;
    if (ay * 128 > ax * 53) bits |= dy < 0 ? BTN_UP : BTN_DOWN;
    return bits;
}

/** 입력 기록 — 버튼 묶음이 바뀐 틱만. 처음 묶음은 0 */
export interface InputLog {
    /** [틱, 묶음, 틱, 묶음, …] */
    inputs: number[];
}

/** 기록에서 틱별 묶음을 차례로 꺼내는 읽개 — tick 을 0 부터 1 씩 올리며 부른다 */
export function createLogReader(log: InputLog): (tick: number) => number {
    let mask = 0;
    let i = 0;
    return (tick: number) => {
        if (i < log.inputs.length && log.inputs[i] === tick) {
            mask = log.inputs[i + 1];
            i += 2;
        }
        return mask;
    };
}
