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
    return {
        capture: () => ({ scrollY: window.scrollY }),

        restore: (value: ScrollSnapshotValue) => {
            const target = value?.scrollY ?? 0;
            // 맨 위였으면 복원할 것이 없다. 굳이 건드리면 스와이프 제스처와 충돌만 난다.
            if (target <= 0) return;

            let tries = 0;
            let done = false;

            /** 문서가 목표에 닿았을 때만 스크롤한다 — clamp 방지의 핵심 */
            const tryScroll = () => {
                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                if (maxScroll >= target - TOLERANCE_PX) {
                    window.scrollTo(0, target);
                    if (Math.abs(window.scrollY - target) <= TOLERANCE_PX) done = true;
                }
            };

            const attempt = () => {
                if (done) return;
                tryScroll();
                tries++;
                if (!done && tries < MAX_FRAMES) requestAnimationFrame(attempt);
            };
            requestAnimationFrame(attempt);

            // 이미지·광고가 로드돼 문서 높이가 바뀔 때마다 재시도
            if (typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(() => {
                    if (done) {
                        ro.disconnect();
                        return;
                    }
                    tryScroll();
                    if (done) ro.disconnect();
                });
                ro.observe(document.documentElement);
                setTimeout(() => {
                    done = true;
                    ro.disconnect();
                }, OBSERVE_TIMEOUT_MS);
            }
        }
    };
}
