/**
 * 게임 공용 입력 — 키보드·터치 버튼을 「틱마다 읽는 비트 묶음」으로 바꾼다.
 *
 * 반복은 시간이 아니라 틱 수로 센다(DAS: 처음 반복까지, ARR: 반복 간격).
 * 그래서 게임 로직은 틱별 입력만 기록하면 그대로 재현된다.
 *
 * 비트 종류
 * - repeat: 누르는 순간 1번 + DAS 뒤부터 ARR 간격으로 반복 (좌우 이동)
 * - hold:   누르고 있는 동안 매 틱 (소프트 드롭)
 * - 그 밖:  누를 때마다 1번 (회전·하드 드롭)
 * 한 틱보다 짧은 탭도 놓치지 않도록 「눌렸음」 표시를 다음 sample 까지 남긴다.
 */
export interface HeldInput {
    press(bit: number): void;
    release(bit: number): void;
    clear(): void;
    sample(): number;
}

export function createHeldInput(opts: {
    repeat: number;
    hold: number;
    das?: number;
    arr?: number;
}): HeldInput {
    const das = opts.das ?? 10;
    const arr = opts.arr ?? 2;
    let held = 0;
    let edge = 0;
    const age: Record<number, number> = {};

    return {
        press(bit) {
            if (held & bit) return;
            held |= bit;
            edge |= bit;
        },
        release(bit) {
            held &= ~bit;
        },
        clear() {
            held = 0;
            edge = 0;
        },
        sample() {
            let out = 0;
            const active = held | edge;
            for (let bit = 1; bit <= active; bit <<= 1) {
                if ((active & bit) === 0) continue;
                const pressedNow = (edge & bit) !== 0;
                if ((opts.repeat & bit) !== 0) {
                    if (pressedNow) {
                        age[bit] = 0;
                        out |= bit;
                    } else {
                        const a = (age[bit] = (age[bit] ?? 0) + 1);
                        if (a >= das && (a - das) % arr === 0) out |= bit;
                    }
                } else if ((opts.hold & bit) !== 0 || pressedNow) {
                    out |= bit;
                }
            }
            edge = 0;
            return out;
        }
    };
}

/** 입력창·편집기에 타이핑 중인 키는 게임이 가로채지 않는다 */
export function isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t || !t.tagName) return false;
    return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/**
 * 키보드를 HeldInput 에 연결한다. map 은 KeyboardEvent.code → 비트
 * (code 를 쓰는 이유: 한글 자판에서는 key 가 'ㅋ' 처럼 바뀐다).
 * isActive() 가 거짓이거나 map 에 없는 키는 onOther 로 넘긴다(시작·일시정지 같은 명령).
 * 리스너가 하나라서, 명령으로 게임이 시작된 바로 그 키가 게임 입력으로 또 들어가지 않는다.
 */
export function bindKeys(
    map: Record<string, number>,
    input: HeldInput,
    isActive: () => boolean,
    onOther?: (e: KeyboardEvent) => void
): () => void {
    const down = (e: KeyboardEvent) => {
        if (isTyping(e)) return;
        const bit = map[e.code];
        if (bit && isActive()) {
            e.preventDefault();
            if (!e.repeat) input.press(bit);
            return;
        }
        onOther?.(e);
    };
    const up = (e: KeyboardEvent) => {
        const bit = map[e.code];
        if (bit) input.release(bit);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
    };
}
