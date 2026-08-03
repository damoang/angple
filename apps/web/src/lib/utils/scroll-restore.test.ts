import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 뒤로가기 스크롤 복원 계약.
 *
 * 지키는 것: **문서가 목표 높이에 못 미치는 동안에는 scrollTo 를 부르지 않는다.**
 * 이 한 줄이 "뒤로 가면 화면이 맨 아래로 떨어진다"(#9401·#13022·#13221)의 방지선이다.
 * 짧은 문서에 scrollTo(큰 값) 을 하면 브라우저가 맨 아래로 clamp 하고 그대로 고착된다.
 *
 * node 환경(테스트 project 'server')이라 DOM 이 없다. 필요한 전역만 주입해 검증한다.
 */

import { createScrollSnapshot } from './scroll-restore';

const scrollTo = vi.fn();
let scrollHeight = 0;
let scrollY = 0;
let rafQueue: FrameRequestCallback[] = [];
let resizeCallbacks: (() => void)[] = [];

const g = globalThis as unknown as Record<string, unknown>;
const saved: Record<string, unknown> = {};

function drainFrames(n: number) {
    for (let i = 0; i < n; i++) {
        const q = rafQueue;
        rafQueue = [];
        if (q.length === 0) return;
        q.forEach((cb) => cb(0));
    }
}

beforeEach(() => {
    scrollTo.mockReset();
    scrollHeight = 0;
    scrollY = 0;
    rafQueue = [];
    resizeCallbacks = [];

    for (const k of ['window', 'document', 'requestAnimationFrame', 'ResizeObserver']) {
        saved[k] = g[k];
    }

    g.window = {
        get scrollY() {
            return scrollY;
        },
        innerHeight: 800,
        scrollTo: (x: number, y: number) => {
            scrollTo(x, y);
            // 브라우저처럼 clamp 한다 — 이 동작이 있어야 사고를 재현할 수 있다
            scrollY = Math.min(y, Math.max(0, scrollHeight - 800));
        }
    };
    g.document = {
        documentElement: {
            get scrollHeight() {
                return scrollHeight;
            }
        }
    };
    g.requestAnimationFrame = (cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
    };
    g.ResizeObserver = class {
        constructor(cb: () => void) {
            resizeCallbacks.push(cb);
        }
        observe() {}
        disconnect() {}
    };
});

afterEach(() => {
    for (const k of Object.keys(saved)) g[k] = saved[k];
});

describe('createScrollSnapshot', () => {
    it('capture 는 현재 스크롤 위치를 담는다', () => {
        scrollY = 1234;
        expect(createScrollSnapshot().capture()).toEqual({ scrollY: 1234 });
    });

    it('⛔ 문서가 짧으면 scrollTo 를 부르지 않는다 (맨 아래 clamp 방지)', () => {
        scrollHeight = 900; // 최대 스크롤 100 < 목표 5000
        createScrollSnapshot().restore({ scrollY: 5000 });
        drainFrames(70);

        expect(scrollTo).not.toHaveBeenCalled();
        expect(scrollY).toBe(0); // 맨 아래로 끌려가지 않았다
    });

    it('문서 높이가 따라오면 그때 복원한다', () => {
        scrollHeight = 900;
        createScrollSnapshot().restore({ scrollY: 5000 });
        drainFrames(3);
        expect(scrollTo).not.toHaveBeenCalled();

        scrollHeight = 6000; // 이미지·댓글이 로드돼 문서가 길어졌다
        drainFrames(3);

        expect(scrollTo).toHaveBeenCalledWith(0, 5000);
        expect(scrollY).toBe(5000);
    });

    it('rAF 상한을 넘긴 뒤에도 ResizeObserver 가 복원한다', () => {
        scrollHeight = 900;
        createScrollSnapshot().restore({ scrollY: 5000 });
        drainFrames(70); // rAF 소진
        expect(scrollTo).not.toHaveBeenCalled();

        scrollHeight = 6000;
        resizeCallbacks.forEach((cb) => cb());

        expect(scrollTo).toHaveBeenCalledWith(0, 5000);
    });

    it('맨 위였으면 아무것도 하지 않는다 (스와이프 제스처 간섭 방지)', () => {
        scrollHeight = 6000;
        createScrollSnapshot().restore({ scrollY: 0 });
        drainFrames(70);
        resizeCallbacks.forEach((cb) => cb());

        expect(scrollTo).not.toHaveBeenCalled();
    });

    it('도달하면 더 이상 스크롤하지 않는다 (사용자 조작 방해 금지)', () => {
        scrollHeight = 6000;
        createScrollSnapshot().restore({ scrollY: 5000 });
        drainFrames(70);
        const callsAfterRestore = scrollTo.mock.calls.length;

        resizeCallbacks.forEach((cb) => cb());
        expect(scrollTo.mock.calls.length).toBe(callsAfterRestore);
    });
});
