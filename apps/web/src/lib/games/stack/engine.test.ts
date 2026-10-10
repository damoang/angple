/**
 * 앙쌓기 엔진 테스트 — 줄 지우기·벽 밀어내기 회전·점수·게임 끝·결정성
 */
import { describe, it, expect } from 'vitest';
import {
    COLS,
    ROWS,
    IN_LEFT,
    IN_RIGHT,
    IN_CW,
    IN_SOFT,
    IN_HARD,
    SHAPES,
    GARBAGE,
    addGarbage,
    createGame,
    fits,
    scoreFor,
    step,
    type Game
} from './engine';

/** 바닥 줄(들)을 한 칸만 비우고 채운다 */
function fillRows(g: Game, rows: number[], hole: number): void {
    for (const r of rows) {
        for (let c = 0; c < COLS; c++) g.board[r * COLS + c] = c === hole ? 0 : 1;
    }
}

/** 세로로 세운 막대(rot 1)를 놓는다 — 상자 안 2번 열을 쓴다 */
function setVerticalBar(g: Game, column: number, y: number): void {
    g.piece = { kind: 0, rot: 1, x: column - 2, y };
}

describe('앙쌓기 엔진', () => {
    it('판 크기는 9×18 이다', () => {
        const g = createGame(1);
        expect(g.board.length).toBe(COLS * ROWS);
        expect(COLS).toBe(9);
        expect(ROWS).toBe(18);
    });

    it('꽉 찬 줄을 지우고 위 칸을 내린다', () => {
        const g = createGame(1);
        fillRows(g, [ROWS - 1], 0);
        setVerticalBar(g, 0, 2);
        step(g, IN_HARD);

        expect(g.lines).toBe(1);
        // 막대 4칸 중 1칸은 지워진 줄과 함께 사라지고, 나머지 3칸이 바닥까지 내려온다
        for (let r = ROWS - 3; r < ROWS; r++) {
            expect(g.board[r * COLS + 0]).not.toBe(0);
            expect(g.board[r * COLS + 1]).toBe(0);
        }
        expect(g.board[(ROWS - 4) * COLS + 0]).toBe(0);
    });

    it('벽에 붙은 막대를 돌리면 안쪽으로 밀어낸다', () => {
        const g = createGame(1);
        setVerticalBar(g, 0, 5);
        expect(fits(g, 0, 1, g.piece.x, g.piece.y)).toBe(true);
        // 가로(rot 2)로 바로 돌리면 왼쪽 벽 밖으로 나간다
        expect(fits(g, 0, 2, g.piece.x, g.piece.y)).toBe(false);

        step(g, IN_CW);
        expect(g.piece.rot).toBe(2);
        expect(g.piece.x).toBe(0);
        for (const [cx] of SHAPES[0][2]) {
            const x = g.piece.x + cx;
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(COLS);
        }
    });

    it('점수표: 줄 수별 점수 × 레벨', () => {
        expect(scoreFor(0, 1)).toBe(0);
        expect(scoreFor(1, 1)).toBe(100);
        expect(scoreFor(2, 1)).toBe(250);
        expect(scoreFor(3, 2)).toBe(900);
        expect(scoreFor(4, 3)).toBe(2100);
    });

    it('두 줄을 한 번에 지우면 점수와 하드 드롭 보너스가 더해진다', () => {
        const g = createGame(7);
        fillRows(g, [ROWS - 2, ROWS - 1], 4);
        setVerticalBar(g, 4, 0);
        // 막대 세로 칸 y=0..3 → 바닥(y=14..17)까지 14칸
        step(g, IN_HARD);
        expect(g.lines).toBe(2);
        expect(g.score).toBe(scoreFor(2, 1) + 14 * 2);
    });

    it('소프트 드롭은 한 칸에 1점', () => {
        const g = createGame(3);
        const y0 = g.piece.y;
        for (let i = 0; i < 4; i++) step(g, IN_SOFT);
        expect(g.piece.y).toBe(y0 + 2);
        expect(g.score).toBe(2);
    });

    it('가운데에만 쌓으면 결국 게임이 끝난다', () => {
        const g = createGame(42);
        for (let i = 0; i < 500 && !g.over; i++) step(g, IN_HARD);
        expect(g.over).toBe(true);
        expect(g.lines).toBe(0);

        const snapshot = JSON.stringify(g);
        step(g, IN_HARD | IN_LEFT);
        expect(JSON.stringify(g)).toBe(snapshot);
    });

    it('같은 seed + 같은 입력이면 같은 판·같은 점수', () => {
        const script = (t: number): number => {
            if (t % 37 === 0) return IN_HARD;
            if (t % 11 === 0) return IN_CW;
            if (t % 7 === 0) return IN_LEFT;
            if (t % 5 === 0) return IN_RIGHT;
            return t % 3 === 0 ? IN_SOFT : 0;
        };
        const run = (seed: number): Game => {
            const g = createGame(seed);
            for (let t = 1; t <= 5000 && !g.over; t++) step(g, script(t));
            return g;
        };
        const a = run(12345);
        const b = run(12345);
        expect(b.score).toBe(a.score);
        expect(b.lines).toBe(a.lines);
        expect(b.board).toEqual(a.board);
        expect(b.tick).toBe(a.tick);

        // 다른 seed 는 다른 조각 순서
        const c = createGame(54321);
        const d = createGame(12345);
        const seq = (g: Game) => [g.piece.kind, g.next, ...g.bag].join(',');
        expect(seq(c)).not.toBe(seq(d));
    });

    it('방해 줄은 바닥에 차고 구멍 열만 비며, 기존 칸은 위로 밀린다', () => {
        const g = createGame(5);
        g.board[(ROWS - 1) * COLS + 0] = 2;
        addGarbage(g, 3, 5);

        expect(g.over).toBe(false);
        for (let r = ROWS - 3; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                expect(g.board[r * COLS + c]).toBe(c === 5 ? 0 : GARBAGE);
            }
        }
        expect(g.board[(ROWS - 4) * COLS + 0]).toBe(2);
        for (let c = 1; c < COLS; c++) expect(g.board[(ROWS - 4) * COLS + c]).toBe(0);
    });

    it('칸이 판 위로 밀려 나가면 게임이 끝난다', () => {
        const g = createGame(5);
        g.board[0 * COLS + 8] = 3;
        addGarbage(g, 1, 0);
        expect(g.over).toBe(true);
    });

    it('떨어지던 조각이 방해 줄과 겹치면 위로 올린다', () => {
        const g = createGame(5);
        // 네모를 바닥(왼쪽 두 열)에 둔다
        g.piece = { kind: 1, rot: 0, x: 0, y: ROWS - 2 };
        addGarbage(g, 2, 8);

        expect(g.over).toBe(false);
        expect(g.piece.y).toBe(ROWS - 4);
        expect(fits(g, 1, 0, g.piece.x, g.piece.y)).toBe(true);
    });

    it('판 밖 구멍 열은 가장 가까운 열로 맞춘다', () => {
        const g = createGame(5);
        addGarbage(g, 1, 99);
        const row = (ROWS - 1) * COLS;
        for (let c = 0; c < COLS; c++) {
            expect(g.board[row + c]).toBe(c === COLS - 1 ? 0 : GARBAGE);
        }
        addGarbage(g, 1, -3);
        for (let c = 0; c < COLS; c++) {
            expect(g.board[row + c]).toBe(c === 0 ? 0 : GARBAGE);
        }
    });
});
