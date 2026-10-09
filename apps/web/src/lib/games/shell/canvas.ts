/**
 * 게임 공용 캔버스 도우미 — 고해상도(HiDPI) 화면에서도 선명하게 그린다.
 * 그리는 쪽은 CSS 픽셀 단위로만 생각하면 된다.
 */

/** 캔버스 내부 해상도를 CSS 크기 × devicePixelRatio 에 맞추고 2D 컨텍스트를 돌려준다 */
export function fitCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
}

/** 요소 크기가 바뀌면 cb 를 부른다. 해제 함수를 돌려준다 */
export function observeSize(el: Element, cb: () => void): () => void {
    if (typeof ResizeObserver === 'undefined') {
        window.addEventListener('resize', cb);
        return () => window.removeEventListener('resize', cb);
    }
    const ro = new ResizeObserver(cb);
    ro.observe(el);
    return () => ro.disconnect();
}

/** 사용자가 움직임 줄이기를 켰는가 */
export function prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
