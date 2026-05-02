/**
 * 광고 폴백/차단 이벤트 텔레메트리 (Dantry → ClickHouse)
 *
 * audit P1-C: AdFit fallback silent fail 해소.
 * 5/22 AdSense 매니저 미팅 직결 — fill rate 정확 측정.
 *
 * 이벤트 타입:
 * - ad_fallback_success : AdFit SDK 로드 성공 (폴백 정상 동작)
 * - ad_fallback_failed  : AdFit SDK 로드 명시적 실패 (script.onerror)
 * - ad_fallback_timeout : AdFit SDK 8s 내 미로드 (네트워크 지연/차단)
 * - ad_sdk_blocked      : googletag + kakao_ad 둘 다 미존재 (uBlock / Brave 추정)
 *
 * 송신 정책: navigator.sendBeacon 우선 (페이지 unload 무관), 미지원 시 fetch keepalive.
 * PII 미송신 (mb_id 는 PHPSESSID → Dantry 측에서 매핑).
 *
 * ClickHouse 집계 예 (PR body 참고):
 *   SELECT toDate(ts) AS d, message, count() AS c
 *   FROM error_logs.js_errors
 *   WHERE message IN ('ad_fallback_success','ad_fallback_failed',
 *                     'ad_fallback_timeout','ad_sdk_blocked')
 *     AND ts >= now() - INTERVAL 7 DAY
 *   GROUP BY d, message ORDER BY d DESC;
 */

const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';

export type AdTelemetryEventName =
    | 'ad_fallback_success'
    | 'ad_fallback_failed'
    | 'ad_fallback_timeout'
    | 'ad_sdk_blocked';

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
