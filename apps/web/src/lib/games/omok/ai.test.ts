/**
 * 오목 AI 테스트 — 즉시 승리·4 막기·난이도별 탐색 깊이·시간 상한
 */
import { describe, it, expect } from 'vitest';
import {
    BLACK,
    WHITE,
    EMPTY,
    SIZE,
    DIFFICULTIES,
    DIFFICULTY_SETTINGS,
    checkWin,
    createBoard,
    evaluateBoard,
    getAiMove,
    isDifficulty,
    searchAiMove,
    WIN_SCORE,
    type Board
} from './ai';

function place(b: Board, stones: [number, number][], color: number): Board {
    for (const [x, y] of stones) b[y][x] = color;
    return b;
}

const fixedRng = () => 0.5;

describe('난이도 설정', () => {
    it('초급/중급/고급 라벨', () => {
        expect(DIFFICULTIES.map((d) => DIFFICULTY_SETTINGS[d].label)).toEqual([
            '초급',
            '중급',
            '고급'
        ]);
    });

    it('깊이는 초급 1 · 중급 2 · 고급 3 — 고급이 중급보다 깊다', () => {
        expect(DIFFICULTY_SETTINGS.easy.depth).toBe(1);
        expect(DIFFICULTY_SETTINGS.medium.depth).toBe(2);
        expect(DIFFICULTY_SETTINGS.hard.depth).toBe(3);
    });

    it('흔들림은 초급 > 중급 > 고급(0)', () => {
        expect(DIFFICULTY_SETTINGS.easy.noise).toBeGreaterThan(DIFFICULTY_SETTINGS.medium.noise);
        expect(DIFFICULTY_SETTINGS.medium.noise).toBeGreaterThan(0);
        expect(DIFFICULTY_SETTINGS.hard.noise).toBe(0);
        expect(DIFFICULTY_SETTINGS.hard.topN).toBeGreaterThan(0);
    });

    it('isDifficulty 는 세 값만 받는다', () => {
        expect(isDifficulty('easy')).toBe(true);
        expect(isDifficulty('hard')).toBe(true);
        expect(isDifficulty('normal')).toBe(false);
        expect(isDifficulty(null)).toBe(false);
    });
});

describe('checkWin', () => {
    it('가로 5목을 찾는다', () => {
        const b = place(
            createBoard(),
            [
                [3, 3],
                [4, 3],
                [5, 3],
                [6, 3],
                [7, 3]
            ],
            BLACK
        );
        expect(checkWin(b, 5, 3, BLACK)?.length).toBe(5);
        expect(checkWin(b, 5, 3, WHITE)).toBeNull();
    });

    it('4목은 승리가 아니다', () => {
        const b = place(
            createBoard(),
            [
                [3, 3],
                [4, 4],
                [5, 5],
                [6, 6]
            ],
            WHITE
        );
        expect(checkWin(b, 6, 6, WHITE)).toBeNull();
    });
});

describe('AI 수 선택', () => {
    it('빈 판이면 정중앙', () => {
        expect(getAiMove(createBoard(), 'hard')).toEqual({ x: 7, y: 7 });
    });

    it.each(DIFFICULTIES)('%s — 열린 4가 있으면 바로 이긴다', (d) => {
        const b = createBoard();
        place(
            b,
            [
                [5, 7],
                [6, 7],
                [7, 7],
                [8, 7]
            ],
            WHITE
        );
        place(
            b,
            [
                [5, 8],
                [6, 8],
                [7, 9],
                [9, 9]
            ],
            BLACK
        );
        const m = getAiMove(b, d, { rng: fixedRng });
        b[m.y][m.x] = WHITE;
        expect(checkWin(b, m.x, m.y, WHITE)).not.toBeNull();
    });

    it.each(DIFFICULTIES)('%s — 상대의 4는 막는다', (d) => {
        const b = createBoard();
        // 흑 4개, 왼쪽 끝은 백이 막아 둔 상태 → (9,7) 만 남는다
        place(
            b,
            [
                [5, 7],
                [6, 7],
                [7, 7],
                [8, 7]
            ],
            BLACK
        );
        place(
            b,
            [
                [4, 7],
                [6, 9]
            ],
            WHITE
        );
        const m = getAiMove(b, d, { rng: fixedRng });
        expect(m).toEqual({ x: 9, y: 7 });
    });

    it.each(DIFFICULTIES)('%s — 내가 이길 수 있으면 막기보다 이긴다', (d) => {
        const b = createBoard();
        place(
            b,
            [
                [2, 2],
                [3, 2],
                [4, 2],
                [5, 2]
            ],
            BLACK
        );
        place(
            b,
            [
                [2, 10],
                [3, 10],
                [4, 10],
                [5, 10]
            ],
            WHITE
        );
        const m = getAiMove(b, d, { rng: fixedRng });
        b[m.y][m.x] = WHITE;
        expect(checkWin(b, m.x, m.y, WHITE)).not.toBeNull();
    });

    it('고급은 상대의 열린 3을 막는다', () => {
        const b = createBoard();
        place(
            b,
            [
                [6, 7],
                [7, 7],
                [8, 7]
            ],
            BLACK
        );
        place(b, [[7, 8]], WHITE);
        const m = getAiMove(b, 'hard');
        expect([
            [5, 7],
            [9, 7],
            [4, 7],
            [10, 7]
        ]).toContainEqual([m.x, m.y]);
    });

    it('호출자의 판을 바꾸지 않는다', () => {
        const b = place(
            createBoard(),
            [
                [7, 7],
                [8, 8]
            ],
            BLACK
        );
        b[7][8] = WHITE;
        const before = JSON.stringify(b);
        getAiMove(b, 'hard');
        expect(JSON.stringify(b)).toBe(before);
    });

    it('두는 자리는 항상 빈칸', () => {
        const b = createBoard();
        place(
            b,
            [
                [7, 7],
                [8, 7],
                [6, 8]
            ],
            BLACK
        );
        place(
            b,
            [
                [7, 8],
                [8, 8]
            ],
            WHITE
        );
        for (const d of DIFFICULTIES) {
            const m = getAiMove(b, d);
            expect(m.x).toBeGreaterThanOrEqual(0);
            expect(m.x).toBeLessThan(SIZE);
            expect(b[m.y][m.x]).toBe(EMPTY);
        }
    });
});

describe('탐색 깊이·시간 상한', () => {
    function midGame(): Board {
        const b = createBoard();
        place(
            b,
            [
                [7, 7],
                [8, 8],
                [6, 9]
            ],
            BLACK
        );
        place(
            b,
            [
                [8, 7],
                [7, 9]
            ],
            WHITE
        );
        return b;
    }

    it('난이도별로 끝까지 마친 깊이가 다르다', () => {
        const opts = { rng: fixedRng, timeLimitMs: 60_000 };
        expect(searchAiMove(midGame(), 'easy', opts).depthReached).toBe(1);
        expect(searchAiMove(midGame(), 'medium', opts).depthReached).toBe(2);
        expect(searchAiMove(midGame(), 'hard', opts).depthReached).toBe(3);
    });

    it('고급은 중급보다 더 많은 국면을 본다', () => {
        const opts = { rng: fixedRng, timeLimitMs: 60_000 };
        const medium = searchAiMove(midGame(), 'medium', opts);
        const hard = searchAiMove(midGame(), 'hard', opts);
        expect(hard.nodes).toBeGreaterThan(medium.nodes);
    });

    it('시간이 다 되면 마지막으로 끝난 깊이의 수를 낸다', () => {
        // 부를 때마다 1초씩 흐르는 가짜 시계 — 깊이 2 시작 직후 바로 시간 초과
        let t = 0;
        const now = () => (t += 1000);
        const b = midGame();
        const r = searchAiMove(b, 'hard', { now, timeLimitMs: 1500 });
        expect(r.depthReached).toBeGreaterThanOrEqual(1);
        expect(r.depthReached).toBeLessThan(3);
        expect(b[r.move.y][r.move.x]).toBe(EMPTY);
    });

    it('고급은 흔들림이 없어 같은 판에 같은 수', () => {
        const a = getAiMove(midGame(), 'hard', { rng: () => 0, timeLimitMs: 60_000 });
        const c = getAiMove(midGame(), 'hard', { rng: () => 0.99, timeLimitMs: 60_000 });
        expect(a).toEqual(c);
    });
});

describe('evaluateBoard', () => {
    it('둘 차례에 4가 있으면 이긴 판으로 본다', () => {
        const b = place(
            createBoard(),
            [
                [3, 3],
                [4, 3],
                [5, 3],
                [6, 3]
            ],
            WHITE
        );
        expect(evaluateBoard(b, WHITE)).toBeGreaterThanOrEqual(WIN_SCORE / 2);
        expect(evaluateBoard(b, BLACK)).toBeLessThanOrEqual(-WIN_SCORE / 2);
    });
});
