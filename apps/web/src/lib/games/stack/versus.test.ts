/**
 * 앙쌓기 대전 규칙 테스트 — 공격표·판 직렬화·최소 레벨·혼자하기 기록 검사식
 */
import { describe, it, expect } from 'vitest';
import {
    COLS,
    ROWS,
    TICK_MS,
    GARBAGE,
    IN_CW,
    IN_HARD,
    IN_LEFT,
    IN_RIGHT,
    IN_SOFT,
    createGame,
    scoreFor,
    step
} from './engine';
import {
    ATTACK,
    RULES,
    attackFor,
    cellBalanceOk,
    decodeBoard,
    encodeBoard,
    levelFloor,
    offsetAttack,
    soloClaimCheck,
    type SoloClaim
} from './versus';

describe('앙쌓기 대전 규칙', () => {
    it('공격표: 1→0, 2→1, 3→2, 4→4', () => {
        expect(ATTACK).toEqual([0, 0, 1, 2, 4]);
        expect([0, 1, 2, 3, 4].map(attackFor)).toEqual([0, 0, 1, 2, 4]);
        expect(attackFor(5)).toBe(0);
        expect(attackFor(-1)).toBe(0);
    });

    it('상쇄: 쌓인 방해 줄을 먼저 지우고 남은 만큼 보낸다', () => {
        expect(offsetAttack(3, 4)).toEqual({ pending: 0, send: 1 });
        expect(offsetAttack(5, 2)).toEqual({ pending: 3, send: 0 });
        expect(offsetAttack(0, 2)).toEqual({ pending: 0, send: 2 });
    });

    it('규칙표: 공격은 방해 줄·10분, 40줄은 방해 줄 없음·5분', () => {
        expect(RULES.attack.garbage).toBe(true);
        expect(RULES.attack.timeLimitSec).toBe(600);
        expect(RULES.sprint40.garbage).toBe(false);
        expect(RULES.sprint40.goalLines).toBe(40);
        expect(RULES.sprint40.timeLimitSec).toBe(300);
    });

    it('판 직렬화는 162자 0~8 이고 그대로 되돌아온다', () => {
        const g = createGame(9);
        g.board[0] = 1;
        g.board[COLS - 1] = 7;
        g.board[(ROWS - 1) * COLS] = GARBAGE;
        g.board[ROWS * COLS - 1] = 4;
        const s = encodeBoard(g.board);

        expect(s.length).toBe(162);
        expect(s).toMatch(/^[0-8]{162}$/);
        // 위 줄부터: 첫 글자 = 맨 위 왼쪽 칸
        expect(s[0]).toBe('1');
        expect(s[COLS - 1]).toBe('7');
        expect(s[(ROWS - 1) * COLS]).toBe('8');
        expect(decodeBoard(s)).toEqual(g.board);

        expect(decodeBoard(s.slice(1))).toBeNull();
        expect(decodeBoard(s.slice(1) + '9')).toBeNull();
        expect(decodeBoard('x'.repeat(162))).toBeNull();
    });

    it('최소 레벨: 공격은 120초부터 30초마다 +1, 40줄은 그대로', () => {
        const sec = (s: number) => s * 60;
        expect(levelFloor(RULES.attack, 0)).toBe(1);
        expect(levelFloor(RULES.attack, sec(120) - 1)).toBe(1);
        expect(levelFloor(RULES.attack, sec(120))).toBe(2);
        expect(levelFloor(RULES.attack, sec(150) - 1)).toBe(2);
        expect(levelFloor(RULES.attack, sec(150))).toBe(3);
        expect(levelFloor(RULES.attack, sec(600))).toBe(18);
        expect(levelFloor(RULES.sprint40, sec(300))).toBe(1);
    });

    it('대전 칸 보존식', () => {
        expect(cellBalanceOk(0, 0, 0)).toBe(true);
        expect(cellBalanceOk(9, 0, 4)).toBe(true); // 36 − 36 = 0
        expect(cellBalanceOk(8, 0, 4)).toBe(false); // 지운 줄이 칸보다 많다
        expect(cellBalanceOk(2, 1, 1)).toBe(true); // 8 + 8 − 9 = 7
        expect(cellBalanceOk(41, 0, 0)).toBe(false); // 164 > 162
    });
});

describe('혼자하기 기록 검사', () => {
    it('실제로 돌린 판의 기록은 통과한다', () => {
        const script = (t: number): number => {
            if (t % 37 === 0) return IN_HARD;
            if (t % 11 === 0) return IN_CW;
            if (t % 7 === 0) return IN_LEFT;
            if (t % 5 === 0) return IN_RIGHT;
            return t % 3 === 0 ? IN_SOFT : 0;
        };
        const g = createGame(2024);
        let pieces = 0;
        const clears: number[] = [];
        for (let t = 1; t <= 20000 && !g.over; t++) {
            const r = step(g, script(t));
            if (r.locked) pieces++;
            if (r.cleared > 0) clears.push(r.cleared);
        }
        const claim: SoloClaim = {
            score: g.score,
            lines: g.lines,
            level: g.level,
            ticks: g.tick,
            pieces,
            clears
        };
        const res = soloClaimCheck(claim, g.tick * TICK_MS);
        expect(res.reasons).toEqual([]);
        expect(res.ok).toBe(true);
    });

    // 21조각·9줄(4+4+1): 8줄째에서 레벨 2 → 마지막 1줄은 100×2
    const base: SoloClaim = {
        score: scoreFor(4, 1) + scoreFor(4, 1) + scoreFor(1, 2) + 40,
        lines: 9,
        level: 2,
        ticks: 3000,
        pieces: 21,
        clears: [4, 4, 1]
    };
    const elapsed = 3000 * TICK_MS;

    it('정상 기록은 통과하고 줄 점수를 재계산한다', () => {
        const res = soloClaimCheck(base, elapsed);
        expect(res.ok).toBe(true);
        expect(res.clearScore).toBe(1600);
        expect(res.dropScore).toBe(40);
    });

    it('조작한 기록은 걸린다', () => {
        const bad = (patch: Partial<SoloClaim>, ms = elapsed) =>
            soloClaimCheck({ ...base, ...patch }, ms).reasons;

        expect(bad({ lines: 10 })).toContain('lines_sum');
        expect(bad({ level: 3 })).toContain('level');
        expect(bad({ clears: [4, 4, 5] })).toContain('clears_range');
        expect(bad({ pieces: 20 })).toContain('cells'); // 80 − 81 < 0
        expect(bad({ pieces: 100 })).toContain('cells'); // 400 − 81 > 162
        expect(bad({ score: 1599 })).toContain('score_low');
        expect(bad({ score: 999999 })).toContain('drop_cap');
        expect(bad({}, 10_000)).toContain('ticks_elapsed');
        expect(bad({ ticks: 10 })).toContain('pieces_ticks');
        expect(soloClaimCheck({ ...base, score: -1 }, elapsed).reasons).toEqual(['shape']);
    });
});
