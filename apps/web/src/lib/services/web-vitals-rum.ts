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

/**
 * ⛔ GA4 로만 보내면 SQL 로 캘 수 없다 — 그래서 dantry(ClickHouse)로도 함께 보낸다.
 *
 * 2026-08-19 실측: 데스크톱 CLS 가 8/04 0.12~0.14 → 8/19 0.15~0.20 으로
 * **보름 만에 43% 악화**됐다(목록 0.20 은 구글 "나쁨" 경계 0.25 에 근접).
 * 모바일은 전부 FAST 인데 데스크톱만 AVERAGE 이고, 그 원인이 CLS 하나다.
 *
 * 범인 selector(largestShiftTarget)는 이미 수집되고 있었지만 **GA4 안에만 있어**
 * "무엇이 미는가" 를 쿼리로 좁힐 수 없었다. 그 갭을 메운다.
 *
 * ⛔ 프런트를 늦추지 않는다:
 *   - web-vitals 가 pagehide/visibilitychange(hidden) 시점에 최종값을 1회만 준다.
 *     그 콜백 안에서 sendBeacon 한 번 — 렌더 경로에 아무것도 추가하지 않는다.
 *   - **표본은 페이지 단위로 한 번 결정한다.** 지표별로 따로 뽑으면 같은 페이지의
 *     CLS·LCP·INP 가 짝이 안 맞아 조인이 불가능해진다.
 */
const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';
const RUM_SAMPLE_RATE = 0.1;
/** 이 페이지 로드를 표본으로 삼을지 — 한 번 정하고 세 지표가 같은 결정을 공유한다 */
const rumSampled = typeof window !== 'undefined' && Math.random() < RUM_SAMPLE_RATE;

function sendToDantry(
    name: string,
    value: number,
    target: string,
    group: string,
    detail: string
): void {
    if (!rumSampled) return;
    try {
        const nav = (
            performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        )?.type;
        const payload = {
            type: 'web_vitals',
            reason: name,
            channel: 'rum',
            message: `web_vitals ${name}`,
            // ⛔ 수집기는 스키마에 없는 필드를 버린다(js_errors 컬럼 고정). stack 에 싣는다.
            stack: [
                `value=${value}`,
                `target=${target}`,
                `page=${group}`,
                `nav=${nav ?? '?'}`,
                `vw=${window.innerWidth}`,
                // ⛔ 이 한 필드가 원인을 가른다:
                //   loading         = 초기 로딩 중 밀림 → 이미지·폰트·SSR 콘텐츠 계열
                //   dom-interactive = 파싱 후 밀림     → 하이드레이션·초기 스크립트 계열
                //   complete        = 로드 완료 후 밀림 → 광고·지연 로드 계열
                // 처방이 셋 다 다르다. 없으면 또 가설만 늘어난다(2026-08-20).
                `detail=${detail}`
            ].join('\n'),
            url: location.href,
            userAgent: navigator.userAgent
        };
        const body = JSON.stringify(payload);
        if (typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon(DANTRY_URL, new Blob([body], { type: 'application/json' }));
        }
    } catch {
        // 관측 실패는 무시 — 사용자 영향이 없어야 한다
    }
}

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
        // ⛔ detail 을 `string` 으로 받으면 안 된다. web-vitals 의 loadState·
        //    interactionType 은 `string | undefined` 라 svelte-check 가 막는다
        //    (2026-08-20 CI 실패 2건). undefined 로 받아 전송 직전에 '?' 로 채운다.
        const send = (
            name: string,
            value: number,
            target: string | undefined,
            detail: string | undefined
        ) => {
            const v = name === 'CLS' ? Math.round(value * 1000) : Math.round(value);
            const t = (target ?? '').slice(0, 100);
            const g = pathGroup(location.pathname);
            trackEvent('web_vitals', {
                metric_name: name,
                metric_value: v,
                metric_target: t,
                page_group: g
            });
            // GA4 와 **같은 값**을 dantry 로도 보낸다(표본만). 두 곳이 어긋나면 안 된다.
            sendToDantry(name, v, t, g, detail ?? '?');
        };
        // 각 메트릭은 페이지 생애 최종값을 pagehide/visibilitychange(hidden) 시 1회 보고한다.
        // gtag 는 sendBeacon 으로 hidden 시점 플러시 → 언로드 유실 없음.
        // ⚠️ SPA soft-nav 는 미수집(installed 가드+web-vitals v6 옵션 미활성): 랜딩→이탈만 정확.
        //    사내 네비게이션은 LCP 를 hide 시점 경로로 오태깅하므로 분석 시 랜딩 필터 전제.
        // ⛔ 메트릭마다 attribution 필드 이름이 다르다. 느슨한 unknown 으로 받으면
        //    오필드를 조용히 숨겨 계측이 죽는다(2026-07-31 Evaluator 정정 이력).
        onCLS((m) =>
            send('CLS', m.value, m.attribution.largestShiftTarget, m.attribution.loadState)
        );
        onLCP((m) =>
            send(
                'LCP',
                m.value,
                m.attribution.target,
                m.attribution.resourceLoadDelay > 0 ? 'resource' : 'render'
            )
        );
        onINP((m) =>
            send('INP', m.value, m.attribution.interactionTarget, m.attribution.interactionType)
        );
    });
}
