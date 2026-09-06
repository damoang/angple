/**
 * 히스토리 병합 계측 — bug/13858 (데스크탑판 #989).
 *
 * 증상: 목록→글 이동 후 뒤로가기가 목록을 건너뛰고 최초 빈 탭(about:blank)으로 간다.
 * 기전 가설(#989): 하이드레이션 replaceState 직후의 내비 pushState 가 한 틱으로 병합돼
 *   새 엔트리 대신 현재(/free) 엔트리를 덮어쓴다. 배포된 가드(app.html 의 void history.length)는
 *   WebKit 에만 효과가 있어 Windows Chrome 은 여전히 샌다(제보 13858).
 *
 * ⭐ 병합의 지문 = **pushState 가 history.length 를 늘리지 못한 순간**. 정상 pushState 는
 *   길이를 +1 한다. 증가가 없으면 병합/덮어쓰기다. 글 페이지에서(JS 가 살아있는 시점) 잡아,
 *   어느 엔진에서 실제로 나는지와 replaceState 와의 시간차를 확정한다.
 *   — about:blank 로 이탈한 뒤에는 우리 JS 가 못 도니, 이탈 전에 지문을 남긴다.
 *
 * ⛔ 개인정보: href·제목·회원 식별자를 절대 담지 않는다. pathGroup 익명화 + 길이·시간·엔진만.
 * ⛔ 병합이 확정된 순간에만 비콘. 정상 내비게이션은 한 줄도 안 나간다.
 * ⛔ 관측 전용 — 히스토리 동작을 바꾸지 않는다(측정만 하고 원함수를 그대로 통과).
 */
import { DANTRY_URL, pathGroup, authSignature } from './web-vitals-rum';

const MAX_PER_PAGE = 3;
// 브라우저 history.length 는 대개 50 에서 포화한다. 포화 상태의 pushState 는 길이가 안 늘어도
// 병합이 아니라 상한이다 — 오탐 방지로 상한 근처는 제외한다.
const HISTORY_LENGTH_CAP_GUARD = 48;

let sent = 0;
let lastReplaceTs = 0;
let installed = false;

/** 내비게이션마다 예산 초기화(같은 세션에서 여러 목록→글 이동을 각각 잡는다). */
export function resetHistoryProbeBudget(): void {
    sent = 0;
}

function engine(): string {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'webkit-ios';
    if (/Edg\//.test(ua)) return 'chromium-edge';
    if (/Firefox\//.test(ua)) return 'gecko';
    if (/Chrome\/|CriOS|Chromium/.test(ua)) return 'chromium';
    if (/Safari\//.test(ua)) return 'webkit';
    return 'other';
}

function beacon(
    fromPath: string,
    msSinceReplace: number,
    lenBefore: number,
    lenAfter: number
): void {
    try {
        let stateIdx: string | number = '?';
        if (history.state && typeof history.state.index === 'number')
            stateIdx = history.state.index;
        let ref = '';
        if (document.referrer) {
            try {
                ref = pathGroup(new URL(document.referrer).pathname);
            } catch {
                ref = '?';
            }
        }
        const lines = [
            `engine=${engine()}`,
            `merge=pushState_no_increment`,
            `len=${lenBefore}->${lenAfter}`,
            `msSinceReplace=${msSinceReplace}`,
            `from=${fromPath}`,
            `to=${pathGroup(location.pathname)}`,
            `ref=${ref}`,
            `stateIdx=${stateIdx}`,
            `auth=${authSignature()}`
        ];
        const payload = {
            type: 'history_merge',
            reason: 'history_merge',
            channel: 'rum',
            message: 'history_merge',
            // 수집기는 js_errors 컬럼 고정이라 스키마 밖 필드는 버린다 — stack 에 싣는다.
            stack: lines.join('\n'),
            url: `${location.origin}${pathGroup(location.pathname)}`,
            userAgent: navigator.userAgent
        };
        const body = JSON.stringify(payload);
        if (typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon(DANTRY_URL, new Blob([body], { type: 'application/json' }));
        }
    } catch {
        // 관측 실패는 무시 — 사용자 조작에 영향이 있으면 안 된다
    }
}

export function initHistoryProbe(): void {
    if (installed || typeof history === 'undefined') return;
    if (typeof history.pushState !== 'function' || typeof history.replaceState !== 'function')
        return;
    installed = true;

    // 원 함수를 history 에 바인딩해 그대로 통과시킨다(동작 무변경, 관측만).
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.replaceState = function (
        data: unknown,
        unused: string,
        url?: string | URL | null
    ): void {
        origReplace(data, unused, url);
        lastReplaceTs = performance.now();
    };
    history.pushState = function (data: unknown, unused: string, url?: string | URL | null): void {
        const lenBefore = history.length;
        const fromPath = pathGroup(location.pathname);
        origPush(data, unused, url);
        const lenAfter = history.length;
        // 병합 지문: pushState 인데 길이가 안 늘었다(상한 포화는 제외).
        if (lenAfter <= lenBefore && lenBefore < HISTORY_LENGTH_CAP_GUARD && sent < MAX_PER_PAGE) {
            sent++;
            beacon(fromPath, Math.round(performance.now() - lastReplaceTs), lenBefore, lenAfter);
        }
    };
}
