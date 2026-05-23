/**
 * 광고 폴백/차단 이벤트 텔레메트리 (Dantry → ClickHouse)
 *
 * audit P1-C: AdFit fallback silent fail 해소.
 * audit P3   : 페이지 단위 adblock 감지 (Brave / uBlock / AdBlock 사용자 비율 측정).
 * 5/22 AdSense 매니저 미팅 직결 — fill rate 손실 원인 분석.
 *
 * 이벤트 타입:
 * - ad_fallback_success : AdFit SDK 로드 성공 (폴백 정상 동작)
 * - ad_fallback_failed  : AdFit SDK 로드 명시적 실패 (script.onerror)
 * - ad_fallback_timeout : AdFit SDK 8s 내 미로드 (네트워크 지연/차단)
 * - ad_sdk_blocked      : (슬롯 단위) googletag + kakao_ad 둘 다 미존재
 * - ad_blocked          : (페이지 단위) 진입 시 1회 — GA4/Dantry 양쪽 송신
 *
 * 송신 정책: navigator.sendBeacon 우선 (페이지 unload 무관), 미지원 시 fetch keepalive.
 * PII 미송신 (mb_id 는 PHPSESSID → Dantry 측에서 매핑).
 *
 * ClickHouse 집계 예 (PR body 참고):
 *   SELECT toDate(ts) AS d, message, count() AS c
 *   FROM error_logs.js_errors
 *   WHERE message IN ('ad_fallback_success','ad_fallback_failed',
 *                     'ad_fallback_timeout','ad_sdk_blocked','ad_blocked')
 *     AND ts >= now() - INTERVAL 7 DAY
 *   GROUP BY d, message ORDER BY d DESC;
 */

const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';

export type AdTelemetryEventName =
    | 'ad_fallback_success'
    | 'ad_fallback_failed'
    | 'ad_fallback_timeout'
    | 'ad_sdk_blocked'
    | 'ad_blocked';

export interface AdTelemetryPayload {
    ad_unit?: string;
    position?: string;
    reason?: string;
    [key: string]: unknown;
}

// 같은 슬롯+이벤트 중복 송신 방지 (페이지 단위)
const sentKeys = new Set<string>();

export function trackAdEvent(name: AdTelemetryEventName, props: AdTelemetryPayload = {}): void {
    if (typeof window === 'undefined') return;

    const dedupeKey = `${name}:${props.position ?? ''}:${props.ad_unit ?? ''}`;
    if (sentKeys.has(dedupeKey)) return;
    sentKeys.add(dedupeKey);

    const payload = {
        message: name,
        type: 'ad_telemetry',
        url: location.href,
        userAgent: navigator.userAgent,
        ts: Date.now(),
        ...props
    };

    try {
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
        // 송신 실패는 무시 (모니터링 데이터, 사용자 영향 X)
    }
}

/**
 * SDK 차단 감지: googletag + kakao_ad (adfit) 둘 다 미존재 시 true.
 * uBlock Origin / Brave Shields 등 광고 차단기 사용자 추정.
 */
export function isAdSdkBlocked(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    const hasGam = !!w.googletag && typeof w.googletag.cmd !== 'undefined';
    const hasAdfit = typeof w.adfit === 'function';
    return !hasGam && !hasAdfit;
}

/**
 * uBlock 패턴 bait 검사: 광고처럼 보이는 element 를 만들어
 * 차단기가 hide 시켰는지 (offsetHeight===0) 확인. 동기. ~1ms.
 */
function isAdBaitHidden(): boolean {
    if (typeof document === 'undefined' || !document.body) return false;
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner ad-placement pub_300x250';
    bait.setAttribute('aria-hidden', 'true');
    // 화면 밖 + 1px — 시각 영향 0
    bait.style.cssText =
        'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;';
    bait.innerHTML = '&nbsp;';
    document.body.appendChild(bait);
    let hidden = false;
    try {
        // 차단기는 보통 display:none / visibility:hidden / 0px 적용
        const cs = window.getComputedStyle(bait);
        hidden =
            bait.offsetParent === null ||
            bait.offsetHeight === 0 ||
            cs.display === 'none' ||
            cs.visibility === 'hidden';
    } finally {
        bait.remove();
    }
    return hidden;
}

// 페이지 단위 dedupe — pathname 단위로 1회만 송신
const adblockCheckedPaths = new Set<string>();

/**
 * 페이지 진입 시 1회 adblock 감지 → GA4 `ad_blocked` 이벤트 + Dantry 송신.
 *
 * @param pageType - GA4 page_type ('home' | 'board_list' 등). 이벤트 라벨링용.
 * @param boardId  - 게시판 ID (선택, GA4 dimension)
 * @param delayMs  - SDK 로드 대기 (기본 3000ms — googletag/adfit script 로드 시간 확보)
 *
 * 호출 측에서 page type 필터링 권장 (홈/게시판만). 그 외 페이지는 skip.
 *
 * 감지 로직 (보고서 §4-4):
 *   1) `isAdSdkBlocked()` — SDK 객체 부재
 *   2) `isAdBaitHidden()` — bait element hide 여부 (uBlock cosmetic filter)
 *   둘 중 하나라도 true 면 차단으로 판정 (false positive 보다 false negative 가 분석 손해)
 *
 * 부정적 UX 영향 0 — 차단된 사용자에게 어떤 안내/광고도 노출하지 않음.
 */
export function detectAdblockOnce(
    pageType: string,
    boardId: string = 'none',
    delayMs: number = 3000
): void {
    if (typeof window === 'undefined') return;

    const path = location.pathname;
    if (adblockCheckedPaths.has(path)) return;
    adblockCheckedPaths.add(path);

    // requestIdleCallback 우선 (저성능 기기 보호), fallback setTimeout
    const schedule = (cb: () => void) => {
        const w = window as any;
        if (typeof w.requestIdleCallback === 'function') {
            w.requestIdleCallback(() => setTimeout(cb, delayMs), { timeout: delayMs + 1000 });
        } else {
            setTimeout(cb, delayMs);
        }
    };

    schedule(() => {
        let blocked = false;
        let reason: 'sdk_missing' | 'bait_hidden' | 'none' = 'none';
        try {
            if (isAdSdkBlocked()) {
                blocked = true;
                reason = 'sdk_missing';
            } else if (isAdBaitHidden()) {
                blocked = true;
                reason = 'bait_hidden';
            }
        } catch {
            // 감지 실패는 무시 — 모니터링 신호일 뿐
            return;
        }

        // 안내 UI 노출용 store 갱신 — adblock-notice 컴포넌트가 구독.
        // 동적 import 로 SSR/번들 영향 0 (browser 진입 후에만 실행됨).
        if (blocked) {
            void import('$lib/stores/adblock-notice.svelte')
                .then((m) => m.adblockNotice.set(true, reason))
                .catch(() => {
                    // store 로드 실패 무시 — telemetry 는 그대로 진행
                });
        }

        // GA4 (gtag) — initGA4 호출 후라야 동작. ga4.ts trackEvent 임포트 시 순환 위험 없음.
        try {
            const w = window as any;
            if (typeof w.gtag === 'function') {
                w.gtag('event', 'ad_blocked', {
                    blocked,
                    reason,
                    page_type: pageType,
                    board_id: boardId
                });
            }
        } catch {
            // GA4 송신 실패 무시
        }

        // Dantry — ClickHouse `error_logs.js_errors` 에 적재 (PII 0)
        // position 에 path 포함 → SPA 네비게이션 시 path 별 1회씩 송신 가능
        trackAdEvent('ad_blocked', {
            position: `page:${path}`,
            reason,
            blocked,
            page_type: pageType,
            board_id: boardId
        });
    });
}
