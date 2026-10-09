/**
 * 게임 공용 루프 — requestAnimationFrame 위에서 고정 틱(기본 60Hz)으로 로직을 돌린다.
 *
 * 화면 주사율(60·120·144Hz)과 무관하게 로직은 항상 같은 간격으로 진행된다.
 * 탭 전환 등으로 프레임이 크게 밀리면 maxSteps 까지만 따라잡고 나머지는 버린다
 * (밀린 시간을 한꺼번에 돌려 조각이 순간이동하는 것을 막는다).
 */
export interface GameLoop {
    start(): void;
    stop(): void;
    readonly running: boolean;
}

export function createLoop(tick: () => void, render: () => void, hz = 60, maxSteps = 5): GameLoop {
    const dt = 1000 / hz;
    let raf = 0;
    let last = 0;
    let acc = 0;
    let on = false;

    function frame(now: number) {
        if (!on) return;
        acc += now - last;
        last = now;
        let n = 0;
        while (acc >= dt && n < maxSteps) {
            tick();
            acc -= dt;
            n++;
            if (!on) break;
        }
        if (acc >= dt) acc = 0;
        render();
        if (on) raf = requestAnimationFrame(frame);
    }

    return {
        start() {
            if (on) return;
            on = true;
            last = performance.now();
            acc = 0;
            raf = requestAnimationFrame(frame);
        },
        stop() {
            on = false;
            cancelAnimationFrame(raf);
        },
        get running() {
            return on;
        }
    };
}

/** 탭이 숨겨지거나 창이 포커스를 잃으면 cb 를 부른다. 해제 함수를 돌려준다 */
export function onPageHidden(cb: () => void): () => void {
    const onVisibility = () => {
        if (document.hidden) cb();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', cb);
    return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('blur', cb);
    };
}
