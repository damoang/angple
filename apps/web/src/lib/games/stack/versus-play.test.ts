/**
 * 앙쌓기 대전 진행 — lock 메시지 형식·seq·칸 보존식·방해 줄·topped_out·최소 레벨
 */
import { describe, it, expect } from 'vitest';
import { IN_HARD, IN_LEFT, IN_RIGHT, IN_CW, GARBAGE, COLS, ROWS } from './engine';
import { RULES, cellBalanceOk, decodeBoard, type ClientMessage } from './versus';
import { createVersusPlayer, remainingSeconds, versusGarbage, versusTick } from './versus-play';

type LockMsg = Extract<ClientMessage, { type: 'lock' }>;

const script = (t: number): number => {
    if (t % 23 === 0) return IN_HARD;
    if (t % 11 === 0) return IN_CW;
    if (t % 7 === 0) return IN_LEFT;
    return t % 5 === 0 ? IN_RIGHT : 0;
};

describe('대전 진행', () => {
    it('굳을 때만 lock 을 보내고 seq 는 1부터 하나씩 오른다', () => {
        const p = createVersusPlayer(42, RULES.sprint40);
        const locks: LockMsg[] = [];
        let ticks = 0;
        for (let t = 1; t <= 3000 && !p.game.over; t++) {
            const r = versusTick(p, script(t));
            ticks++;
            for (const m of r.out) if (m.type === 'lock') locks.push(m);
        }
        expect(ticks).toBeGreaterThan(0);
        expect(locks.length).toBeGreaterThan(5);
        locks.forEach((m, i) => {
            expect(m.data.seq).toBe(i + 1);
            expect(m.data.cleared).toBeGreaterThanOrEqual(0);
            expect(m.data.cleared).toBeLessThanOrEqual(4);
            expect(decodeBoard(m.data.board)).not.toBeNull();
            if (i > 0) expect(m.data.tick).toBeGreaterThanOrEqual(locks[i - 1].data.tick);
        });
    });

    it('방해 줄을 받아도 칸 보존식이 맞고, 넘치면 topped_out 을 한 번만 보낸다', () => {
        const p = createVersusPlayer(7, RULES.attack);
        let locks = 0;
        let cleared = 0;
        let garbage = 0;
        const topped: ClientMessage[] = [];
        for (let t = 1; t <= 20000; t++) {
            const r = versusTick(p, script(t));
            for (const m of r.out) {
                if (m.type === 'lock') {
                    locks++;
                    cleared += m.data.cleared;
                    expect(cellBalanceOk(locks, garbage, cleared)).toBe(true);
                    // 서버가 줄을 못 지운 lock 뒤에 방해 줄을 넣으라고 보낸 상황
                    if (m.data.cleared === 0 && locks % 4 === 0) {
                        const before = p.game.over;
                        topped.push(...versusGarbage(p, 2, locks % COLS));
                        if (!before) garbage += 2;
                    }
                }
                if (m.type === 'topped_out') topped.push(m);
            }
            if (p.game.over && t > 10) {
                // 끝난 뒤의 틱은 아무것도 보내지 않는다
                expect(versusTick(p, IN_HARD).out).toEqual([]);
                break;
            }
        }
        expect(p.game.over).toBe(true);
        expect(topped.filter((m) => m.type === 'topped_out')).toHaveLength(1);
        expect(p.game.board.some((v) => v === GARBAGE)).toBe(true);
    });

    it('끝난 판에는 방해 줄을 넣지 않는다', () => {
        const p = createVersusPlayer(1, RULES.attack);
        p.game.over = true;
        p.toppedOut = true;
        const before = p.game.board.slice();
        expect(versusGarbage(p, 4, 0)).toEqual([]);
        expect(p.game.board).toEqual(before);
    });

    it('공격 모드는 120초부터 최소 레벨이 오르고, 스프린트는 그대로다', () => {
        const a = createVersusPlayer(3, RULES.attack);
        a.game.tick = 120 * 60;
        versusTick(a, 0);
        expect(a.game.level).toBe(2);
        a.game.tick = 150 * 60;
        versusTick(a, 0);
        expect(a.game.level).toBe(3);

        const s = createVersusPlayer(3, RULES.sprint40);
        s.game.tick = 200 * 60;
        versusTick(s, 0);
        expect(s.game.level).toBe(1);
    });

    it('남은 시간은 엔진 틱 기준 초 단위다', () => {
        expect(remainingSeconds(300_000, 0)).toBe(300);
        expect(remainingSeconds(300_000, 60)).toBe(299);
        expect(remainingSeconds(300_000, 300 * 60 + 100)).toBe(0);
    });

    it('판 크기는 9×18 이다', () => {
        const p = createVersusPlayer(9, RULES.sprint40);
        expect(p.game.board).toHaveLength(COLS * ROWS);
    });
});
