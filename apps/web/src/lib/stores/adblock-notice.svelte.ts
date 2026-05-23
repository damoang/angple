/**
 * AdBlock 감지 상태 store — 진입 시 감지된 차단기 여부 + dismiss 상태.
 *
 * detectAdblockOnce (ad-telemetry.ts) 가 차단 판정 시 detected=true 로 set.
 * adblock-notice 컴포넌트가 구독하여 toast 노출.
 *
 * dismiss 정책: localStorage `damoang_adblock_dismissed_until` 에 ts 저장,
 * 7일간 안내 미노출. CTA 클릭 시 /ad-free 이동 후 자연스럽게 dismiss.
 */

const DISMISS_KEY = 'damoang_adblock_dismissed_until';
const DISMISS_DAYS = 7;

function loadDismissedUntil(): number {
    if (typeof localStorage === 'undefined') return 0;
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        return raw ? Number(raw) || 0 : 0;
    } catch {
        return 0;
    }
}

let detected = $state(false);
let reason = $state<'sdk_missing' | 'bait_hidden' | 'none'>('none');
let dismissedUntil = $state(loadDismissedUntil());

export const adblockNotice = {
    get detected() {
        return detected;
    },
    get reason() {
        return reason;
    },
    get shouldShow() {
        return detected && Date.now() >= dismissedUntil;
    },
    set(d: boolean, r: 'sdk_missing' | 'bait_hidden' | 'none'): void {
        detected = d;
        reason = r;
    },
    dismiss(days: number = DISMISS_DAYS): void {
        const until = Date.now() + days * 24 * 60 * 60 * 1000;
        dismissedUntil = until;
        try {
            localStorage.setItem(DISMISS_KEY, String(until));
        } catch {
            // localStorage 차단된 환경 — 메모리만 유지
        }
    }
};
