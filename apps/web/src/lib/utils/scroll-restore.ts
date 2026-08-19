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

/**
 * 관측 — 복원이 실제로 됐는지 데이터로 본다.
 *
 * ⛔ 왜 필요한가: 뒤로가기 스크롤 복원에는 **텔레메트리가 전혀 없었다.**
 *    "한참 위로 간다"는 제보(free/7060456)를 받고도 몇 명이 겪는지, 어느 경로인지
 *    알 방법이 없었다. Playwright 로는 3/3 정상 복원돼 재현도 안 된다
 *    (goBack 이 진짜 bfcache 복원을 만들지 않아 iOS 전용 경로를 못 탄다).
 *
 * ⛔ 프런트를 늦추지 않는 것이 이 코드의 첫 번째 제약이다.
 *    - 복원 루프(rAF/ResizeObserver) **안에서는 아무 일도 하지 않는다.** 종료 시점 1회뿐.
 *    - `sendBeacon` 을 쓴다. fetch 와 달리 응답을 기다리지 않고 언로드도 막지 않는다.
 *    - `requestIdleCallback` 으로 한가할 때 보낸다(없으면 setTimeout 0).
 *    - **실패 전량 + 성공 1% 표본.** 대부분의 뒤로가기에서는 전송 자체가 없다.
 *
 * ⛔ 대조군(성공 표본)을 빼지 마라. 실패만 모으면 "실패 시 이렇더라"만 알 뿐
 *    정상과 비교가 안 된다 — 2026-08-19 하이드레이션 조사에서 그 벽에 부딪혔다.
 */
const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';
const OK_SAMPLE_RATE = 0.01;

type RestoreCause = 'done' | 'timeout' | 'cancelled';

interface RestoreOutcome {
    /** done=복원 성공 · timeout=3초 안에 못 함 · cancelled=사용자가 먼저 떠남 */
    cause: RestoreCause;
    target: number;
    finalY: number;
    maxScroll: number;
    elapsedMs: number;
    /** 높이가 목표에 한 번이라도 닿았는가 — 처방을 가르는 값 */
    heightReached: boolean;
}

function reportRestore(o: RestoreOutcome): void {
    // ⛔ cancelled 는 실패가 아니다. 사용자가 복원이 끝나기 전에 떠난 것뿐인데,
    //    이걸 실패로 세면 실패율이 부풀려져 판단이 틀어진다. 아예 보내지 않는다.
    if (o.cause === 'cancelled') return;
    // 보낼 이유가 없으면 아무것도 하지 않는다(대부분의 경우).
    if (o.cause === 'done' && Math.random() >= OK_SAMPLE_RATE) return;
    const send = () => {
        try {
            const nav = (
                performance.getEntriesByType('navigation')[0] as
                    | PerformanceNavigationTiming
                    | undefined
            )?.type;
            const payload = {
                type: 'scroll_restore',
                reason: o.cause === 'done' ? 'restore_ok' : 'restore_timeout',
                channel: 'snapshot',
                message: `scroll restore ${o.cause}`,
                // ⛔ 수집기는 스키마에 없는 필드를 버린다(js_errors 컬럼 고정). stack 에 싣는다.
                stack: [
                    `target=${o.target}`,
                    `final=${o.finalY}`,
                    `maxScroll=${o.maxScroll}`,
                    `heightReached=${o.heightReached}`,
                    `elapsed=${o.elapsedMs}ms`,
                    `nav=${nav ?? '?'}`
                ].join('\n'),
                url: location.href,
                userAgent: navigator.userAgent
            };
            const body = JSON.stringify(payload);
            if (typeof navigator.sendBeacon === 'function') {
                const blob = new Blob([body], { type: 'application/json' });
                if (navigator.sendBeacon(DANTRY_URL, blob)) return;
            }
            fetch(DANTRY_URL, {
                mode: 'cors',
                credentials: 'include',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true
            }).catch(() => {});
        } catch {
            // 관측 실패는 무시한다 — 사용자 영향이 없어야 한다
        }
    };
    // 한가할 때 보낸다. 복원 직후는 렌더가 바쁜 구간이라 여기서 경쟁시키지 않는다.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
        .requestIdleCallback;
    if (typeof ric === 'function') ric(send);
    else setTimeout(send, 0);
}

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
            // 관측용. ⛔ 루프 안에서는 계산하지 않는다 — 플래그 하나만 켜고 끝낸다.
            const startedAt = Date.now();
            let heightReached = false;
            let reported = false;

            /** rAF·ResizeObserver·timeout 을 모두 정리하고 활성 핸들을 비운다 */
            const cleanup = (cause: RestoreCause = done ? 'done' : 'cancelled') => {
                // 이 복원의 결말을 한 번만 보고한다.
                // ⛔ cleanup 은 성공·타임아웃·이탈 세 경로에서 불린다. 셋을 구분해야
                //    "실패율" 이 의미를 갖는다. 기본값은 done 여부로 추정하되,
                //    타임아웃 경로는 명시적으로 넘긴다.
                if (!reported) {
                    reported = true;
                    reportRestore({
                        cause,
                        target,
                        finalY: window.scrollY,
                        maxScroll: document.documentElement.scrollHeight - window.innerHeight,
                        elapsedMs: Date.now() - startedAt,
                        heightReached
                    });
                }
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
                    // 처방을 가르는 값: 높이는 됐는데 스크롤이 안 된 것인지,
                    // 높이가 끝내 안 된 것인지. 대입 하나라 비용이 없다.
                    heightReached = true;
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
                    // 여기 도달 = 3초 안에 목표에 못 갔다. 진짜 실패다.
                    cleanup('timeout');
                }, OBSERVE_TIMEOUT_MS);
            }
        }
    };
}
