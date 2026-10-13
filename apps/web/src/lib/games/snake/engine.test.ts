/**
 * 뱀 게임 엔진 — 결정성, 기존 규칙(속도·충돌·반대 방향), 재연 검사, 서버와 공용 테스트 벡터.
 * testdata/vectors.json 은 서버 저장소(internal/stack_srv/testdata/snake_vectors.json)와 같은 파일이다.
 */
import { describe, it, expect } from 'vitest';
import {
    DIR_DOWN,
    DIR_LEFT,
    DIR_RIGHT,
    DIR_UP,
    GRID,
    MAX_TICKS,
    canTurn,
    checkInputs,
    createGame,
    mulberry32,
    replay,
    speedFor,
    step
} from './engine';
import vectors from './testdata/vectors.json';

interface Vector {
    name: string;
    seed: number;
    inputs: unknown;
    expect: {
        error: string;
        score: number;
        ticks: number;
        simMs: number;
        reason: string;
        foods: number[][];
    };
}

describe('뱀 엔진 — 기존 규칙', () => {
    it('시작 뱀과 방향은 기존 화면과 같다', () => {
        const g = createGame(1);
        expect(g.snake).toEqual([
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ]);
        expect(g.dir).toBe(DIR_RIGHT);
        expect(g.food).not.toBeNull();
        expect(g.snake.some((s) => s.x === g.food!.x && s.y === g.food!.y)).toBe(false);
    });

    it('속도 = max(60, 150 − floor(점수/3)×5)', () => {
        expect(speedFor(0)).toBe(150);
        expect(speedFor(2)).toBe(150);
        expect(speedFor(3)).toBe(145);
        expect(speedFor(53)).toBe(65);
        expect(speedFor(54)).toBe(60);
        expect(speedFor(300)).toBe(60);
    });

    it('반대 방향은 무시하고 직진한다', () => {
        const g = createGame(1);
        step(g, DIR_LEFT);
        expect(g.dir).toBe(DIR_RIGHT);
        expect(g.snake[0]).toEqual({ x: 11, y: 10 });
        expect(canTurn(g, DIR_LEFT)).toBe(false);
        expect(canTurn(g, DIR_RIGHT)).toBe(false);
        expect(canTurn(g, DIR_UP)).toBe(true);
    });

    it('먹이를 먹으면 1점, 한 칸 길어지고 새 먹이는 몸 위에 없다', () => {
        const g = createGame(7);
        g.food = { x: 11, y: 10 };
        const ate = step(g, DIR_RIGHT);
        expect(ate).toBe(true);
        expect(g.score).toBe(1);
        expect(g.snake.length).toBe(4);
        expect(g.snake.some((s) => s.x === g.food!.x && s.y === g.food!.y)).toBe(false);
    });

    it('벽에 닿으면 끝(wall), 그 틱 간격도 시간에 들어간다', () => {
        const g = createGame(1);
        g.food = { x: 0, y: 0 };
        while (!g.over) step(g);
        expect(g.reason).toBe('wall');
        expect(g.tick).toBe(10);
        expect(g.simMs).toBe(1500);
        expect(step(g, DIR_UP)).toBe(false);
        expect(g.tick).toBe(10);
    });

    it('꼬리 끝 칸에 닿아도 끝(self) — 기존 화면과 같다', () => {
        const g = createGame(1);
        g.food = { x: 0, y: 0 };
        g.snake = [
            { x: 5, y: 5 },
            { x: 5, y: 6 },
            { x: 6, y: 6 },
            { x: 6, y: 5 }
        ];
        g.dir = DIR_UP;
        step(g, DIR_RIGHT);
        expect(g.over).toBe(true);
        expect(g.reason).toBe('self');
    });

    it('최대 틱에서 끝난다(limit)', () => {
        const g = createGame(1);
        g.food = { x: 0, y: 0 };
        g.tick = MAX_TICKS - 1;
        step(g, DIR_DOWN);
        expect(g.over).toBe(true);
        expect(g.reason).toBe('limit');
    });

    it('빈칸이 없으면 끝(full)', () => {
        const g = createGame(1);
        const body: { x: number; y: number }[] = [];
        for (let y = 0; y < GRID; y++) {
            for (let x = 0; x < GRID; x++) if (!(x === 0 && y === 0)) body.push({ x, y });
        }
        // 머리 (1,0) 에서 왼쪽 (0,0) 의 먹이를 먹으면 판이 꽉 찬다 — 몸은 (1,0) 을 뺀 나머지
        g.snake = [{ x: 1, y: 0 }, ...body.filter((p) => !(p.x === 1 && p.y === 0))];
        g.dir = DIR_LEFT;
        g.food = { x: 0, y: 0 };
        step(g, DIR_LEFT);
        expect(g.over).toBe(true);
        expect(g.reason).toBe('full');
        expect(g.score).toBe(1);
        expect(g.food).toBeNull();
    });
});

describe('뱀 엔진 — 결정성', () => {
    it('mulberry32 는 uint32 를 낸다', () => {
        let s = 0xffffffff;
        for (let i = 0; i < 1000; i++) {
            const [next, u] = mulberry32(s);
            expect(Number.isInteger(u) && u >= 0 && u <= 0xffffffff).toBe(true);
            expect(Number.isInteger(next) && next >= 0 && next <= 0xffffffff).toBe(true);
            s = next;
        }
    });

    it('같은 seed 는 같은 먹이 순서를 낸다', () => {
        const a = replay(2026, [[0, DIR_UP]]);
        const b = replay(2026, [[0, DIR_UP]]);
        expect(a).toEqual(b);
        expect(replay(2027, []).foods).not.toEqual(replay(2026, []).foods);
    });
});

describe('뱀 엔진 — 입력 검사', () => {
    it('모양이 틀리면 shape', () => {
        expect(checkInputs(null)).toBe('shape');
        expect(checkInputs({})).toBe('shape');
        expect(checkInputs([[1]])).toBe('shape');
        expect(checkInputs([[1, 2, 3]])).toBe('shape');
        expect(checkInputs([['1', 0]])).toBe('shape');
        expect(checkInputs([[MAX_TICKS, 0]])).toBe('shape');
        expect(checkInputs(new Array(MAX_TICKS + 1).fill([0, 0]))).toBe('shape');
        expect(checkInputs([])).toBe('');
        expect(
            checkInputs([
                [0, 0],
                [5, 1]
            ])
        ).toBe('');
    });

    it('방향 값·틱 순서', () => {
        expect(checkInputs([[0, -1]])).toBe('input_dir');
        expect(checkInputs([[0, 1.5]])).toBe('input_dir');
        expect(
            checkInputs([
                [3, 0],
                [3, 1]
            ])
        ).toBe('input_order');
        expect(
            checkInputs([
                [3, 0],
                [2, 1]
            ])
        ).toBe('input_order');
    });
});

describe('뱀 엔진 — 서버와 공용 테스트 벡터', () => {
    const list = (vectors as unknown as { vectors: Vector[] }).vectors;

    it('벡터가 있다(점수가 나는 판 포함)', () => {
        expect(list.length).toBeGreaterThan(10);
        expect(list.some((v) => v.expect.score >= 20)).toBe(true);
        expect(list.some((v) => v.expect.reason === 'self')).toBe(true);
    });

    for (const v of list) {
        it(v.name, () => {
            const r = replay(v.seed, v.inputs);
            expect(r.error).toBe(v.expect.error);
            expect(r.ok).toBe(v.expect.error === '');
            expect(r.score).toBe(v.expect.score);
            expect(r.ticks).toBe(v.expect.ticks);
            expect(r.simMs).toBe(v.expect.simMs);
            expect(r.reason).toBe(v.expect.reason);
            expect(r.foods.map((p) => [p.x, p.y])).toEqual(v.expect.foods);
        });
    }
});
