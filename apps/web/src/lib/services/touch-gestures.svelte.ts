/**
 * 터치 제스처 서비스
 *
 * 스와이프(이전/다음글), 더블탭(추천) 감지.
 * 입력 필드 내에서는 무시.
 */

interface TouchGestureCallbacks {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onDoubleTap?: () => void;
}

interface TouchPoint {
    x: number;
    y: number;
    time: number;
}

function isInputElement(el: EventTarget | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return (
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.contentEditable === 'true'
    );
}

export class TouchGestureService {
    private callbacks: TouchGestureCallbacks = {};
    private startPoint: TouchPoint | null = null;
    private lastTap: TouchPoint | null = null;
    private swipeThreshold = 50;
    private doubleTapInterval = 300;
    private active = false;

    activate(
        callbacks: TouchGestureCallbacks,
        options?: { swipeThreshold?: number; doubleTapInterval?: number }
    ) {
        this.callbacks = callbacks;
        this.swipeThreshold = options?.swipeThreshold ?? 50;
        this.doubleTapInterval = options?.doubleTapInterval ?? 300;

        if (!this.active) {
            document.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
            this.active = true;
        }
    }

    deactivate() {
        if (this.active) {
            document.removeEventListener('touchstart', this.handleTouchStart);
            document.removeEventListener('touchend', this.handleTouchEnd);
            this.active = false;
        }
        this.callbacks = {};
        this.startPoint = null;
        this.lastTap = null;
    }

    private handleTouchStart = (e: TouchEvent) => {
        if (isInputElement(e.target)) return;
        const touch = e.touches[0];
        if (!touch) return;
        this.startPoint = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    };

    private handleTouchEnd = (e: TouchEvent) => {
        if (isInputElement(e.target)) return;
        if (!this.startPoint) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        const dx = touch.clientX - this.startPoint.x;
        const dy = touch.clientY - this.startPoint.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const now = Date.now();

        // 스와이프 감지: 수평 이동 > threshold && 수평 > 수직 (세로 스크롤과 분리)
        if (absDx > this.swipeThreshold && absDx > absDy) {
            if (dx < 0 && this.callbacks.onSwipeLeft) {
                e.preventDefault();
                this.callbacks.onSwipeLeft();
            } else if (dx > 0 && this.callbacks.onSwipeRight) {
                e.preventDefault();
                this.callbacks.onSwipeRight();
            }
            this.lastTap = null;
            this.startPoint = null;
            return;
        }

        // 더블탭 감지: 이동거리 < 10px && 시간 간격 < interval
        if (absDx < 10 && absDy < 10 && this.callbacks.onDoubleTap) {
            if (this.lastTap && now - this.lastTap.time < this.doubleTapInterval) {
                const tapDx = Math.abs(touch.clientX - this.lastTap.x);
                const tapDy = Math.abs(touch.clientY - this.lastTap.y);
                if (tapDx < 30 && tapDy < 30) {
                    e.preventDefault();
                    this.callbacks.onDoubleTap();
                    this.lastTap = null;
                    this.startPoint = null;
                    return;
                }
            }
            this.lastTap = { x: touch.clientX, y: touch.clientY, time: now };
        }

        this.startPoint = null;
    };
}
