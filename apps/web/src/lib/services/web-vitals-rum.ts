/**
 * 실사용자(RUM) Core Web Vitals 계측.
 * 설계: CLS/LCP/INP 를 attribution 과 함께 GA4 로 보내 "무엇이 CWV 를 악화시키는가" 를
 * 실사용자 기준으로 확정한다. cwv_daily(PSI lab, 4개 URL 샘플)의 한계를 넘어
 * 전 페이지 실측 + 범인 요소(largestShiftTarget/LCP element/INP target) 확보.
 *
 * 발단: 2026-07-31 데스크톱 글상세 CLS 0.216 중 97%가 "본문 카드 밀림" 인데,
 * PSI lab 은 "밀린 요소" 만 주고 "민 주체" 를 안 줘 원인 특정 불가.
 * 이 계측이 largestShiftTarget 을 실사용자에서 수집해 그 갭을 메운다.
 *
 * 성능 영향 0: 페이지 로드 완료 후 브라우저 유휴 시점에 후처리로만 동작.
 */
import { trackEvent } from './ga4';

/** URL 경로를 게시판 단위로 그룹화(고카디널리티 방지). /free/123 → /free/:id */
function pathGroup(pathname: string): string {
    return pathname
        .replace(/^\/([a-zA-Z0-9_-]+)\/\d+.*$/, '/$1/:id')
        .replace(/\/\d+/g, '/:n')
        .slice(0, 60);
}

let installed = false;

export function initWebVitalsRum(): void {
    if (typeof window === 'undefined' || installed) return;
    installed = true;

    void import('web-vitals/attribution').then(({ onCLS, onLCP, onINP }) => {
        /**
         * @param name  메트릭명
         * @param value CLS 는 소수(×1000 정수화), LCP/INP 는 ms(반올림)
         * @param target 범인 요소 selector — 메트릭별 attribution 필드를 콜백에서 직접 넘겨
         *               타입 안전 보장(느슨한 unknown 은 오필드를 숨겨 계측을 죽인다. LCP 는
         *               web-vitals v6 에서 `.element` 가 아니라 `.target` — 2026-07-31 Evaluator 정정)
         */
        const send = (name: string, value: number, target: string | undefined) => {
            trackEvent('web_vitals', {
                metric_name: name,
                metric_value: name === 'CLS' ? Math.round(value * 1000) : Math.round(value),
                metric_target: (target ?? '').slice(0, 100),
                page_group: pathGroup(location.pathname)
            });
        };
        // 각 메트릭은 페이지 생애 최종값을 pagehide/visibilitychange(hidden) 시 1회 보고한다.
        // gtag 는 sendBeacon 으로 hidden 시점 플러시 → 언로드 유실 없음.
        // ⚠️ SPA soft-nav 는 미수집(installed 가드+web-vitals v6 옵션 미활성): 랜딩→이탈만 정확.
        //    사내 네비게이션은 LCP 를 hide 시점 경로로 오태깅하므로 분석 시 랜딩 필터 전제.
        onCLS((m) => send('CLS', m.value, m.attribution.largestShiftTarget));
        onLCP((m) => send('LCP', m.value, m.attribution.target));
        onINP((m) => send('INP', m.value, m.attribution.interactionTarget));
    });
}
