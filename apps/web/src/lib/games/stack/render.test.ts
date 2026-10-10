/**
 * 앙쌓기 그리기 — 캔버스 없이 호출 기록만 남기는 가짜 컨텍스트로 본다.
 */
import { describe, it, expect } from 'vitest';
import { COLS, ROWS, GARBAGE, createGame } from './engine';
import { encodeBoard } from './versus';
import { GARBAGE_COLOR, PALETTE, drawBoard, drawNext } from './render';

interface Call {
    name: string;
    args: unknown[];
}

/** 메서드 호출과 fillStyle 대입을 기록하는 가짜 2D 컨텍스트 */
function fakeCtx(withRoundRect = true) {
    const calls: Call[] = [];
    const fills: string[] = [];
    let fillStyle = '';
    const target: Record<string, unknown> = {
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt'
    };
    const ctx = new Proxy(target, {
        get(t, prop: string) {
            if (prop === 'fillStyle') return fillStyle;
            if (prop === 'roundRect' && !withRoundRect) return undefined;
            if (prop in t) return t[prop];
            return (...args: unknown[]) => calls.push({ name: prop, args });
        },
        set(t, prop: string, value) {
            if (prop === 'fillStyle') {
                fillStyle = value;
                fills.push(value);
            } else t[prop] = value;
            return true;
        }
    });
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, fills };
}

const count = (calls: Call[], name: string) => calls.filter((c) => c.name === name).length;

describe('앙쌓기 그리기', () => {
    it('빈 판은 격자만 그린다', () => {
        const { ctx, calls } = fakeCtx();
        const g = createGame(1);
        drawBoard(ctx, g.board, 20, { grid: '#ccc' });
        expect(calls[0]).toEqual({ name: 'clearRect', args: [0, 0, 20 * COLS, 20 * ROWS] });
        expect(count(calls, 'moveTo')).toBe(COLS - 1 + ROWS - 1);
        expect(count(calls, 'roundRect')).toBe(0);
    });

    it('떨어지는 조각은 판 안의 칸만 그린다', () => {
        const { ctx, calls } = fakeCtx();
        const g = createGame(1);
        drawBoard(ctx, g.board, 20, { piece: g.piece });
        // 칸 하나 = 둥근 사각형 2개(타일 + 광택)
        expect(count(calls, 'roundRect')).toBe(4 * 2);
    });

    it('문자열 판(상대 판)과 방해 줄 칸을 그린다', () => {
        const { ctx, calls, fills } = fakeCtx(false);
        const board = new Array<number>(COLS * ROWS).fill(0);
        board[COLS * ROWS - 1] = GARBAGE;
        board[COLS * ROWS - 2] = 1;
        drawBoard(ctx, encodeBoard(board), 10);
        expect(count(calls, 'rect')).toBeGreaterThanOrEqual(4);
        expect(fills).toContain(GARBAGE_COLOR);
        expect(fills).toContain(PALETTE[0]);
    });

    it('길이가 맞지 않는 문자열 판은 빈 판으로 본다', () => {
        const { ctx, calls } = fakeCtx();
        drawBoard(ctx, '', 10);
        drawBoard(ctx, '8'.repeat(10), 10);
        expect(count(calls, 'roundRect')).toBe(0);
    });

    it('다음 조각: 종류마다 네 칸, null 이면 비운다', () => {
        for (let kind = 0; kind < 7; kind++) {
            const { ctx, calls } = fakeCtx();
            drawNext(ctx, 64, 64, kind);
            expect(count(calls, 'roundRect')).toBe(4 * 2);
        }
        const { ctx, calls } = fakeCtx();
        drawNext(ctx, 64, 64, null);
        expect(calls).toEqual([{ name: 'clearRect', args: [0, 0, 64, 64] }]);
    });
});
