/**
 * 댓글 입력 이상 계측 — 모바일에서 작성 중 키보드가 내려가는 현상(#12939 / #13045) 진단용.
 *
 * ## 왜 필요한가
 * 이 실패 모드는 **예외를 던지지 않는다.** 그래서 `error_logs.js_errors` 에 아무것도 남지 않고,
 * 열흘 동안 세운 가설 다섯 개가 전부 추측이었다가 하나씩 반증됐다:
 *   - 앙티티 카드 지연 삽입 → SSR 이라 늦게 도착하지 않음
 *   - 광고 갱신/폴백 스왑 → 제보자가 광고차단 미사용
 *   - 지연로딩 경합       → 제보자가 진입 한참 뒤에 작성
 *   - pageshow 리로드      → 초안 보존이 없어 텍스트가 유실됐어야 함(신고 없음)
 *   - 서비스워커 stale 청크 → 삼성 인터넷 청크 에러 0.5%
 *
 * 추측으로 고치면 2026-07-10 과 같은 실패("고쳤다" → 열흘 뒤 재발)를 반복한다.
 * 그래서 고치기 전에 **다음 재발이 원인을 말하게** 만든다.
 *
 * ## 설계 원칙
 * - **에디터에 포커스가 있는 동안에만** 관측한다. 평상시 비용 0.
 * - 정상 이탈(제출/사용자가 다른 곳 클릭)은 보내지 않는다. **이상 이탈만** 1회.
 * - 페이지당 1회만 전송(중복 방지).
 * - PII 없음 — 입력 내용은 절대 담지 않고, 길이/시각/레이아웃 수치만 담는다.
 */

const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';

/** 페이지당 1회만 전송 */
let sent = false;

interface WatchState {
    focusAt: number;
    scrollY: number;
    docHeight: number;
    vvHeight: number;
    /** 포커스 중 관측된 최대 문서 높이 변화량(px) — 레이아웃 이동 크기 */
    maxDocDelta: number;
    /** 포커스 중 DOM 변경 횟수 */
    mutations: number;
    /** 마지막 DOM 변경 요약(태그/클래스만, 내용 없음) */
    lastMutation: string;
    /** 마지막 DOM 변경 시각 */
    lastMutationAt: number;
    /** visualViewport 높이가 크게 늘어난 시각 = 키보드 닫힘 추정 */
    keyboardClosedAt: number;
    cleanup: () => void;
}

let state: WatchState | null = null;

function send(reason: string, extra: Record<string, unknown>): void {
    if (sent) return;
    sent = true;
    try {
        const payload = {
            message: 'comment_input_anomaly',
            type: 'comment_input_telemetry',
            reason,
            url: location.href,
            userAgent: navigator.userAgent,
            ts: Date.now(),
            ...extra
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
        // 계측 실패는 무시 — 사용자 동작에 절대 영향을 주지 않는다
    }
}

/** 요소를 내용 없이 요약 (PII 차단) */
function describe(node: Node | null): string {
    if (!node) return '';
    const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
    if (!el) return node.nodeName;
    const cls = (el.className || '').toString().split(/\s+/).slice(0, 3).join('.');
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
}

/**
 * 댓글 에디터가 포커스를 얻었을 때 호출. 포커스를 잃으면 자동으로 해제된다.
 * 이상 이탈이면 1회 전송한다.
 */
export function watchCommentInput(editorEl: HTMLElement): void {
    if (typeof window === 'undefined' || sent) return;
    stopWatch();

    const vv = window.visualViewport;
    const s: WatchState = {
        focusAt: Date.now(),
        scrollY: window.scrollY,
        docHeight: document.documentElement.scrollHeight,
        vvHeight: vv?.height ?? window.innerHeight,
        maxDocDelta: 0,
        mutations: 0,
        lastMutation: '',
        lastMutationAt: 0,
        keyboardClosedAt: 0,
        cleanup: () => {}
    };

    // 입력창 위쪽에서 일어나는 DOM 변경만 본다 — 아래쪽 변경은 입력창을 밀지 않는다.
    const mo = new MutationObserver((records) => {
        for (const r of records) {
            const target = r.target as Element;
            if (target === editorEl || editorEl.contains(target)) continue; // 자기 입력은 제외
            s.mutations++;
            s.lastMutation = describe(target);
            s.lastMutationAt = Date.now();
        }
        const delta = Math.abs(document.documentElement.scrollHeight - s.docHeight);
        if (delta > s.maxDocDelta) s.maxDocDelta = delta;
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });

    // visualViewport 높이가 크게 늘면 키보드가 닫힌 것으로 본다
    const onVvResize = () => {
        const h = vv?.height ?? window.innerHeight;
        if (h - s.vvHeight > 80) s.keyboardClosedAt = Date.now();
        s.vvHeight = Math.max(s.vvHeight, h);
    };
    vv?.addEventListener('resize', onVvResize);

    const onBlur = () => {
        const now = Date.now();
        const heldMs = now - s.focusAt;
        // 키보드가 닫힌 정황이 있고, 사용자가 다른 입력요소로 이동한 게 아니면 이상으로 본다.
        const next = document.activeElement;
        const movedToAnotherInput = !!next?.closest?.(
            '.ProseMirror, [contenteditable="true"], textarea, input, button, a'
        );
        const keyboardDropped = s.keyboardClosedAt > 0 && now - s.keyboardClosedAt < 1500;

        if (keyboardDropped && !movedToAnotherInput) {
            send('keyboard_dropped', {
                held_ms: heldMs,
                mutations: s.mutations,
                last_mutation: s.lastMutation,
                ms_since_last_mutation: s.lastMutationAt ? now - s.lastMutationAt : -1,
                max_doc_delta: s.maxDocDelta,
                scroll_delta: window.scrollY - s.scrollY,
                next_active: describe(next),
                editor_connected: editorEl.isConnected ? 1 : 0
            });
        }
        stopWatch();
    };
    editorEl.addEventListener('focusout', onBlur);

    s.cleanup = () => {
        mo.disconnect();
        vv?.removeEventListener('resize', onVvResize);
        editorEl.removeEventListener('focusout', onBlur);
    };
    state = s;
}

/** 관측 해제 */
export function stopWatch(): void {
    state?.cleanup();
    state = null;
}
