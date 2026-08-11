/**
 * 뒤로가기 스크롤 위치 복원 (목록·상세 공용).
 *
 * ⛔ **문서 높이를 확인하지 않고 `scrollTo(target)` 을 부르면 안 된다.**
 *    뒤로 돌아온 직후에는 이미지·광고·임베드·댓글이 아직 안 그려져 문서가 짧다.
 *    그때 목표 위치로 스크롤하면 브라우저가 **맨 아래로 clamp** 하고, 높이가 끝내
 *    안 따라오면 그 상태로 고착된다 — "뒤로 가면 맨 밑으로 떨어진다" 현상.
 *    (#9401 → #13022 목록 페이지, #13221 글 상세 페이지)
 *
 * 그래서 목표 높이에 도달하기 전에는 아예 호출하지 않고, 높이가 따라올 때까지 재시도한다.
 *   - rAF 최대 60프레임(~1s)
 *   - 그 뒤는 ResizeObserver 로 문서 높이 변화마다 재시도 (3초 상한)
 *
 * ⛔ **복원 루프는 반드시 취소 가능해야 한다.**
 *    `window`·`document.documentElement(<html>)` 은 SPA 네비게이션에서 교체되지 않는다.
 *    한 라우트에서 시작한 rAF/ResizeObserver 루프가 취소되지 않으면, 뒤로가기로
 *    다른 페이지가 마운트된 뒤에도 살아남아 **새 페이지를 옛 target 으로 다시 스크롤**한다
 *    (#13239: 목록이 본문에서 내려간 만큼 내려가 있음, #13221: 스와이프백 시 바닥 착지).
 *    그래서 이 스냅샷은 활성 루프를 하나만 유지하고, 페이지를 떠날 때(capture)와 새 복원을
 *    시작할 때(restore) 이전 루프를 확실히 종료한다.
 *
 * ⛔ 이 로직을 페이지마다 복붙하지 말 것. 2026-03 에 목록만 고치고 상세를 빠뜨려
 *    같은 증상이 5개월 더 남아 있었다. 스크롤 복원이 필요한 페이지는 이 유틸을 쓴다.
 */

/** 목표와 이 정도 차이는 도달로 본다 (서브픽셀·주소창 높이 변동 흡수) */
const TOLERANCE_PX = 2;
/** rAF 재시도 상한 — 이후는 ResizeObserver 가 이어받는다 */
const MAX_FRAMES = 60;
/** 늦게 로드되는 자산까지 기다리는 상한. 넘으면 포기한다 */
const OBSERVE_TIMEOUT_MS = 3000;

export interface ScrollSnapshotValue {
    scrollY: number;
}

/**
 * SvelteKit `snapshot` 으로 그대로 쓸 수 있는 객체를 만든다.
 * 라우트(모듈)마다 한 번 호출 → 각자 독립된 클로저(=독립 활성 루프)를 갖는다.
 *
 * ```svelte
 * <script lang="ts" module>
 *     export const snapshot = createScrollSnapshot();
 * </script>
 * ```
 */
export function createScrollSnapshot(): {
    capture: () => ScrollSnapshotValue;
    restore: (value: ScrollSnapshotValue) => void;
} {
    // 진행 중인 복원 루프를 종료하는 핸들. 이 스냅샷당 하나만 산다.
    // 다음 restore 진입 시(중복 루프 방지)와 capture 시(페이지 떠남) 호출한다.
    let cancelActive: (() => void) | null = null;

    return {
        capture: () => {
            // 이 페이지를 떠난다 — 남아있는 복원 루프가 다음 라우트를 스크롤하지 못하게 끊는다.
            cancelActive?.();
            return { scrollY: window.scrollY };
        },

        restore: (value: ScrollSnapshotValue) => {
            // 새 복원을 시작하기 전에 이전 루프를 반드시 취소한다.
            cancelActive?.();

            const target = value?.scrollY ?? 0;
            // 맨 위였으면 복원할 것이 없다. 굳이 건드리면 스와이프 제스처와 충돌만 난다.
            if (target <= 0) return;

            let done = false;
            let rafId = 0;
            let ro: ResizeObserver | null = null;
            let timeoutId: ReturnType<typeof setTimeout> | undefined;

            /** rAF·ResizeObserver·timeout 을 모두 정리하고 활성 핸들을 비운다 */
            const cleanup = () => {
                done = true;
                if (rafId && typeof cancelAnimationFrame !== 'undefined')
                    cancelAnimationFrame(rafId);
                rafId = 0;
                ro?.disconnect();
                ro = null;
                if (timeoutId !== undefined) clearTimeout(timeoutId);
                timeoutId = undefined;
                // 다른 복원이 이미 활성 핸들을 가져갔다면 그것까지 지우지 않는다.
                if (cancelActive === cleanup) cancelActive = null;
            };
            cancelActive = cleanup;

            /** 문서가 목표에 닿았을 때만 스크롤한다 — clamp 방지의 핵심 */
            const tryScroll = () => {
                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                if (maxScroll >= target - TOLERANCE_PX) {
                    window.scrollTo(0, target);
                    if (Math.abs(window.scrollY - target) <= TOLERANCE_PX) done = true;
                }
            };

            let tries = 0;
            const attempt = () => {
                if (done) return;
                tryScroll();
                tries++;
                if (done) {
                    cleanup();
                    return;
                }
                if (tries < MAX_FRAMES) rafId = requestAnimationFrame(attempt);
            };
            rafId = requestAnimationFrame(attempt);

            // 이미지·광고가 로드돼 문서 높이가 바뀔 때마다 재시도
            if (typeof ResizeObserver !== 'undefined') {
                ro = new ResizeObserver(() => {
                    if (done) {
                        cleanup();
                        return;
                    }
                    tryScroll();
                    if (done) cleanup();
                });
                ro.observe(document.documentElement);
                timeoutId = setTimeout(() => {
                    cleanup();
                }, OBSERVE_TIMEOUT_MS);
            }
        }
    };
}
