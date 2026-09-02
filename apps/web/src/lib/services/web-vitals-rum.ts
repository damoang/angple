/**
 * 실사용자(RUM) Core Web Vitals 계측.
 * 설계: CLS/LCP/INP/TTFB 를 attribution 과 함께 GA4 로 보내 "무엇이 CWV 를 악화시키는가" 를
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
export const DANTRY_URL = 'https://aplog.damoang.net/api/v1/dantry';
const RUM_SAMPLE_RATE = 0.1;
/** 이 페이지 로드를 표본으로 삼을지 — 한 번 정하고 세 지표가 같은 결정을 공유한다 */
const rumSampled = typeof window !== 'undefined' && Math.random() < RUM_SAMPLE_RATE;

/**
 * 이 페이지에서 광고가 **실제로 채워졌는가**.
 *
 * ⛔ 2026-08-20, 남은 데스크톱 CLS(실사용자 p75 0.093)의 원인을 "아마 광고" 라고
 *    추측만 하고 있었다. 데이터센터 IP 의 헤드리스 브라우저에서는 AdSense 가 항상
 *    `unfilled` 이라 재현이 안 된다 — 우리 코드 몫(프로브 0.0017~0.0038)만 확인될 뿐이다.
 *    그래서 **실사용자 쪽에서 광고 충전 여부를 같이 받아** 갈라낸다.
 *    이 한 필드가 "광고를 줄일지" 라는 제품 판단에 숫자를 준다.
 *
 * ⛔ 비용은 pagehide 시점 querySelectorAll 두 번뿐이다. 렌더 경로에 아무것도 안 넣는다.
 * ⛔ 개수만 센다. 광고 내용·식별자는 담지 않는다.
 */
function adFillSignature(): string {
    try {
        const ins = document.querySelectorAll('ins.adsbygoogle');
        let filled = 0;
        // ⛔ NodeList 를 for..of 로 돌면 tsconfig(downlevelIteration)에 따라 CI 에서 막힌다.
        for (let i = 0; i < ins.length; i++) {
            if (ins[i].getAttribute('data-ad-status') === 'filled') filled++;
        }
        // google-auto-placed = AdSense 자동광고가 **우리 슬롯을 안 거치고** 꽂은 컨테이너.
        // 우리 예약 로직 밖이라 따로 센다.
        const auto = document.querySelectorAll('.google-auto-placed').length;
        return `ads=${ins.length}/${filled}/${auto}`;
    } catch {
        return 'ads=?';
    }
}

/* ------------------------------------------------------------------------- *
 * CLS 밀림 방향·민 주체 계측 (2026-09-02, bug/13836)
 *
 * 증상: 모바일 목록에서 글을 터치하면 **아래 글**이 열린다. 석 달째, 두 번째 제보.
 * 손가락이 닿는 순간과 탭이 확정되는 순간 사이에 목록이 **위로** 밀리면,
 * 원래 누르려던 줄이 위로 빠지고 그 자리에 다음 줄이 들어온다.
 *
 * ⛔ **CLS 는 이 증상의 대리 지표로 못 쓴다** — 2026-09-02 헤드리스 실측 3건:
 *   1) 스크롤 앵커링이 관측을 지운다. 같은 200px 축소를 scrollY=0/600/1500 에서 재니
 *      600·1500 에서는 layout-shift 엔트리가 **0개**. 실사용자는 스크롤한 채로 탭한다.
 *   2) `hadRecentInput` 제외가 하필 오탭 구간을 지운다. 모바일 스크롤은 포인터 입력이라
 *      스크롤 직후 500ms 안의 밀림은 CLS 에서 **전부 빠진다**.
 *   3) `sources` 는 **밀린** 요소만 담는다. 제자리에서 **높이만 바뀐** 민 주체는 절대
 *      안 들어오고, rect 가 뷰포트로 클리핑돼 높이가 안 변한 요소가 `dH=-220` 으로 잡힌다.
 *      → "민 주체(mover)" 를 이 API 로 뽑겠다는 접근 자체가 틀렸다. 제거했다.
 *
 * → **증상 자체를 직접 잰다**: `mistouch-probe.ts` 가 손가락이 닿은 좌표에 있던 글과
 *   실제로 열린 글을 비교한다. 이 파일의 CLS 필드는 **보조 축**으로만 남긴다.
 *
 * 여기 남기는 것:
 *   shift= / nsrc= → 가장 큰 단일 소스의 세로 이동량(부호 포함)과 소스 개수.
 *                    ⛔ 예전엔 소스 dTop 을 **합산**해 `px` 를 붙였는데, 그건 밀린 요소
 *                    **개수에 비례**하는 값이었다(5행 밀리면 실제 200px 인데 -1000px).
 *   adh=          → 광고 축. 0보다 크면 "예약보다 크게 렌더" 경로가 열려 있다.
 *   auth=         → 로그인 여부. 로그인 표면에만 있는 요소가 원인이면 여기서 갈린다.
 *
 * ⛔ 렌더 경로에 아무것도 추가하지 않는다. 별도 PerformanceObserver 도 없앴다 —
 *    web-vitals 가 `attribution.largestShiftEntry` 로 같은 엔트리를 주므로 모듈 스코프에
 *    엔트리 배열(DOM 강참조 누적)을 들고 있을 이유가 없다. 계산은 전송 시점 1회.
 * ⛔ CLS 전송에만 붙인다. LCP/INP/TTFB 에는 의미가 없고 페이로드만 커진다.
 * ------------------------------------------------------------------------- */

/**
 * ⛔ `LayoutShift` 는 표준 lib.dom 에 없다(크롬 계열 전용 확장).
 *    전역 타입에 기대면 CI 가 깨지므로 필요한 필드만 로컬로 선언해 쓴다.
 *    ⛔ `any` 로 받으면 ESLint 가 막고, 오필드를 조용히 숨겨 계측이 죽는다
 *       (이 파일은 이미 `detail` 을 `string` 으로 받아 CI 가 2번 깨진 이력이 있다).
 */
interface LayoutShiftSourceLike {
    readonly node: Node | null;
    readonly previousRect: DOMRectReadOnly;
    readonly currentRect: DOMRectReadOnly;
}
export interface LayoutShiftEntryLike extends PerformanceEntry {
    readonly value: number;
    readonly hadRecentInput: boolean;
    readonly sources: ReadonlyArray<LayoutShiftSourceLike> | undefined;
}

/**
 * 뷰포트 경계에 걸리지 않은 **온전한** rect 인가.
 *
 * ⛔ **layout-shift 의 rect 는 뷰포트로 클리핑된다.** 요소가 화면 밖으로 나가면
 *    높이가 0 으로 잘리고 top 도 0 이 된다. 그 rect 로 dTop 을 재면 **부호가 뒤집힌다** —
 *    2026-09-02 검증 실측: `#secA` 가 top 730 → 930 으로 **아래로 200px** 내려갔는데
 *    `currentRect` 가 0 으로 클리핑돼 `dTop=-730`(위로 730)으로 보고됐다.
 *    같은 클리핑 결함이 이미 `mover=`(민 주체) 를 죽였고, `shift=` 에도 그대로 남아 있었다.
 * → 양쪽 rect 가 **둘 다 높이 0 초과이고 뷰포트 안에 온전히 들어와 있는** 소스만 쓴다.
 *   경계에 닿은 rect 는 잘렸는지 아닌지를 rect 만으로 구분할 수 없으므로 **전부 버린다**
 *   (거짓 부호 하나가 없느니만 못하다 — 위 실측이 정확히 그 사고였다).
 * ⚠️ 뷰포트 높이는 **전송 시점**(pagehide)의 `innerHeight` 다. 밀림이 일어난 순간의
 *    값이 아니다(모바일 주소창 접힘 등으로 수십 px 다를 수 있다). 이 판정은 그래서
 *    "확실히 안전한 것만 통과" 쪽으로만 쓴다 — 통과 기준을 넓히면 안 된다.
 */
const VIEWPORT_EDGE_EPS_PX = 1;
function isIntactRect(r: DOMRectReadOnly, viewportHeight: number): boolean {
    if (!(r.height > 0)) return false;
    if (r.top <= VIEWPORT_EDGE_EPS_PX) return false;
    if (r.bottom >= viewportHeight - VIEWPORT_EDGE_EPS_PX) return false;
    return true;
}

/**
 * 가장 큰 밀림 엔트리에서 **가장 크게 밀린 단일 소스의 세로 이동량(부호 포함)** 과
 * **소스 개수** 를 뽑는다.
 *
 * ⭐ 부호가 핵심이다. **음수 = 위로 밀림.**
 * ⛔ 예전 구현은 소스들의 dTop 을 **합산**하고 단위에 `px` 를 붙였다. 그 값은 실제
 *    이동거리가 아니라 **밀린 요소 개수에 비례**한다(5행이 200px 씩 밀리면 -1000px).
 *    그래서 합이 아니라 **최대 절댓값 단일 소스**를 보내고 개수를 따로 싣는다.
 * ⛔ 엔트리는 web-vitals 의 `attribution.largestShiftEntry` 를 그대로 받는다.
 *    직접 PerformanceObserver 를 돌리면 (a) 모듈 스코프에 DOM 강참조가 쌓이고
 *    (b) "가장 큰" 의 기준이 web-vitals 와 어긋나 `target=` 과 짝이 안 맞는다.
 * ⛔ `sources` 는 **밀린** 요소만 담는다. 여기서 "민 주체" 를 유추하지 마라
 *    (2026-09-02 실측: 클리핑된 rect 때문에 정반대 답이 나왔다).
 *
 * ⭐ **읽는 법**: `nsrc>0` 인데 `shift=?` = 소스는 있었지만 **전부 뷰포트 경계에 걸려**
 *   부호를 신뢰할 수 없었다는 뜻이다. `nsrc=0`(소스 없음)·`nsrc=?`(엔트리 없음)와 다르다.
 *   추정치를 채워 넣지 않는다.
 */
function shiftLines(entry: LayoutShiftEntryLike | undefined): string[] {
    try {
        // 엔트리 없음 = 판별 불가. 크롬 계열이 아니거나 밀림이 아예 없었다.
        if (!entry) return ['shift=?', 'nsrc=?'];
        const sources = entry.sources ?? [];
        if (sources.length === 0) return ['shift=?', 'nsrc=0'];
        const vh = window.innerHeight;
        let best: number | null = null;
        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            // 양쪽 rect 가 모두 온전할 때만 dTop 이 실제 이동량이다.
            if (!isIntactRect(s.previousRect, vh) || !isIntactRect(s.currentRect, vh)) continue;
            const d = s.currentRect.top - s.previousRect.top;
            if (best === null || Math.abs(d) > Math.abs(best)) best = d;
        }
        const shift = best === null ? 'shift=?' : `shift=${Math.round(best)}`;
        return [shift, `nsrc=${sources.length}`];
    } catch {
        return ['shift=?', 'nsrc=?'];
    }
}

/**
 * 광고 프레임의 **실제 높이 − 예약 높이** 최댓값(px).
 *
 * ⭐ `min-height` 는 바닥값이라 예약보다 **큰** 광고는 막지 못한다. 그리고 광고는
 *    30~45초마다 갱신되므로, 컸다가 작아지면 그만큼 아래 목록이 **위로** 올라간다.
 *    이 값이 0보다 크면 그 경로가 열려 있다는 뜻이다.
 *    ⛔ 지금 우리 관측에 이 축이 아예 없어서 "아마 광고" 를 확인도 배제도 못 했다.
 *
 * ⛔ 예약값은 ad-slot.svelte 가 인라인으로 주입하는 `--ad-slot-min-height`(= 모바일/base)다.
 *    같은 요소에 `-tablet`·`-desktop` 변형도 있어 넓은 화면에서는 실제 적용값이 다르다 —
 *    분석은 이 필드를 **모바일 표본에서** 읽어라(이번 증상이 모바일이다).
 * ⛔ 비용은 pagehide 시점의 레이아웃 1회뿐. 렌더 경로에는 아무것도 안 넣는다.
 *
 * ⛔ **`.dm-display-floating`(사이드바·윙)은 건너뛴다.** 이 슬롯은 CSS 가
 *    `min-height: 0` 으로 덮는데(ad-slot.svelte) 인라인 `--ad-slot-min-height` 에는
 *    250/600px 이 그대로 남아 있어, 실제 예약이 0인데 `-250`/`-600` 이라는 **헛값**이
 *    나온다. 2026-09-02 라이브 4개 뷰포트 측정에서 확인. in-flow 슬롯만 센다.
 */
export function adOverflowSignature(): string {
    try {
        const frames = document.querySelectorAll<HTMLElement>('.dm-display-frame');
        if (frames.length === 0) return 'adh=none';
        let max: number | null = null;
        let inFlow = 0;
        for (let i = 0; i < frames.length; i++) {
            const el = frames[i];
            // 예약값이 CSS 로 덮이는 floating 계열은 인라인 변수와 실제 적용값이 다르다
            if (el.classList.contains('dm-display-floating')) continue;
            inFlow++;
            const raw = el.style.getPropertyValue('--ad-slot-min-height').trim();
            if (!raw) continue; // 예약값을 못 읽은 요소는 건너뛴다
            const reserved = parseFloat(raw);
            if (!Number.isFinite(reserved)) continue;
            const over = el.getBoundingClientRect().height - reserved;
            if (max === null || over > max) max = over;
        }
        // in-flow 프레임이 하나도 없음(= 전부 floating) 은 `none`. "프레임은 있는데
        // 예약값을 하나도 못 읽음" 은 판별 불가(`?`). 둘을 섞으면 안 된다.
        if (inFlow === 0) return 'adh=none';
        return max === null ? 'adh=?' : `adh=${Math.round(max)}`;
    } catch {
        return 'adh=?';
    }
}

/**
 * 로그인 여부만 1/0 으로.
 *
 * ⛔ **회원 식별자는 절대 담지 않는다.** 값도 파싱하지 않고 **쿠키 이름의 존재만** 본다.
 * 판별 근거로 `user_basic` 쿠키를 고른 이유:
 *   · 이 저장소가 이미 쓰는 client-side 로그인 신호다
 *     (`httpOnly: false` 로 발급 — `lib/server/auth/user-basic.ts`, 로그아웃 시 삭제).
 *   · `authStore` 를 여기서 import 하면 순환 참조·번들 증가가 생긴다. 이 파일은
 *     `initWebVitalsRum()` 전에 아무것도 초기화하지 않는 게 원칙이다.
 *   · `parseUserBasicBase64()`(utils/user-basic-client)를 부르면 atob+JSON 파싱까지
 *     하게 되는데, 우리는 **있다/없다** 만 필요하다. 정규식 한 번이 가장 가볍고 부작용이 없다.
 * ⛔ 쿠키가 없어도 세션이 살아 있을 수 있는 경계(만료 직후 등)에서는 0 으로 셀 수 있다.
 *    이 필드는 **표면을 가르는 용도**지 인증 판정에 쓰면 안 된다.
 */
export function authSignature(): string {
    try {
        return /(?:^|;\s*)user_basic=/.test(document.cookie) ? 'auth=1' : 'auth=0';
    } catch {
        return 'auth=?';
    }
}

function sendToDantry(
    name: string,
    value: number,
    target: string,
    group: string,
    detail: string,
    /** CLS 전용. web-vitals 의 `attribution.largestShiftEntry` — 다른 지표에는 없다. */
    clsEntry?: LayoutShiftEntryLike
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
                // ⛔ 이 필드 없이 page= 로 페이지별 비교를 하면 다른 페이지의 밀림을
                //    이 페이지 탓으로 읽는다(위 landingPath 주석 참조).
                //    분석은 `landing == page` 인 표본만 쓴다.
                `landing=${landingPath}`,
                // 광고 충전 신호: ads=<슬롯수>/<채워진수>/<자동광고 컨테이너수>
                adFillSignature(),
                // ⛔ 이 한 필드가 원인을 가른다:
                //   loading         = 초기 로딩 중 밀림 → 이미지·폰트·SSR 콘텐츠 계열
                //   dom-interactive = 파싱 후 밀림     → 하이드레이션·초기 스크립트 계열
                //   complete        = 로드 완료 후 밀림 → 광고·지연 로드 계열
                // 처방이 셋 다 다르다. 없으면 또 가설만 늘어난다(2026-08-20).
                `detail=${detail}`,
                // ⛔ 기존 8줄은 한 글자도 바꾸지 않는다 — 집계 쿼리가 전부 깨진다.
                //    bug/13836 판별용 4줄은 **CLS 에만** 뒤에 덧붙인다
                //    (LCP/INP/TTFB 에는 의미가 없고 페이로드만 커진다).
                ...(name === 'CLS'
                    ? [...shiftLines(clsEntry), adOverflowSignature(), authSignature()]
                    : [])
            ].join('\n'),
            // ⛔ `location.href` 를 그대로 실으면 `page=` 를 가려도 **같은 행에서 샌다**
            //    (운영 실측 7일 736행/152종에 소셜 mb_id 원문). 쿼리·프래그먼트도 떼어낸다.
            // ⛔ 그렇다고 `pathGroup` 을 통째로 쓰면 안 된다 — `/free/123` 이 `/free/:id` 가 되어
            //    `match(url,'damoang\\.net/[a-z]+/[0-9]+')` 로 글상세를 가르는 감시 두 개
            //    (`adblock_regression_watch.py:148`, `hydration_deploy_verdict.py:49`)가
            //    조용히 뒤집힌다. **숫자 아이디는 남기고 식별자 세그먼트만 가린다.**
            url: location.origin + maskIdentifierSegments(location.pathname),
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

/**
 * **경로 세그먼트가 숫자가 아닌 식별자**로 들어오는 라우트 → 그 세그먼트를 `:id` 로 가린다.
 *
 * ⛔ 이건 이번 변경이 만든 결함이 아니라 **원래 있던 누출**이다. 기존 `pathGroup` 은
 *    **숫자만** 치환해서 `/member/naver_8e22080b` 가 원문 그대로 텔레메트리에 실렸다
 *    (운영 DB 실측: 최근 3일 `web_vitals` 중 331건 — `/member/google_956d0909` 32건,
 *     `/member/naver_8e22080b` 19건 …). 소셜 가입자의 `mb_id` 는 그 자체가 회원 식별자다.
 *
 * ⭐ **가르는 기준 = 실제 라우트 트리**(`apps/web/src/routes/`, 2026-09-02 직접 확인):
 *      member/[id] · member/settings{,/social,/ui,/verify-email} · member/orders{,/[orderId]}
 *      member/leave{,/cancel,/complete} · member/escrow
 *      invite/[token] · go/[id] · checkout/[orderId] · checkout/complete
 *    → 정적 자식 라우트 **이름 목록**을 그대로 적어두고, 그 목록에 없는 세그먼트만 가린다.
 *    "형태로 추정"(소셜 아이디처럼 생겼나)하지 않는다 — 아이디 형식이 바뀌면 조용히 새는데
 *    라우트 목록은 파일 트리로 검증되고, 새 정적 라우트가 생기면 값이 눈에 띄게 변한다.
 * ⛔ **순수 숫자 세그먼트는 건드리지 않는다.** 기존 두 규칙이 이미 `:id`/`:n` 으로 바꾸고
 *    있어서, 여기서 손대면 `/member/orders/:n` 같은 **기존 집계 값이 바뀐다**.
 *    누출되는 것은 비숫자 식별자뿐이므로 그것만 가린다(값 불변은 테스트로 고정).
 * ⛔ 평범한 객체로 만들면 `/toString/x` 같은 경로가 `Object.prototype` 을 주워
 *    예외로 이어진다. Map 으로 둔다.
 */
const IDENTIFIER_ROUTES = new Map<string, ReadonlySet<string>>([
    [
        'member',
        new Set([
            'settings',
            'orders',
            'leave',
            'escrow',
            'social',
            'ui',
            'verify-email',
            'cancel',
            'complete'
        ])
    ],
    // ⛔ `members`(복수형)도 실재한다 — `lib/server/url-compat.ts:74` 가 레거시
    //    `/bbs/profile.php?mb_id=` 를 여기로 보낸다. 404 여도 루트 레이아웃이 떠서
    //    RUM 이 발신된다(운영 실측 7일 95행/44종). 빠뜨리면 그대로 샌다.
    ['members', new Set<string>()],
    ['invite', new Set<string>()],
    ['go', new Set<string>()],
    ['checkout', new Set(['complete'])],
    // ⛔ 재설정 토큰은 회원 식별자보다 민감하다. 로그에 원문이 남으면 안 된다.
    ['password-reset', new Set<string>()],
    // 2단계 접두사 — `/admin/members/<mbId>`. 아래 lookup 이 두 단계를 모두 본다.
    ['admin/members', new Set<string>()]
]);

function maskIdentifierSegments(pathname: string): string {
    const segs = pathname.split('/');
    // 1단계(`/member/…`)와 2단계(`/admin/members/…`) 접두사를 모두 본다.
    let known = IDENTIFIER_ROUTES.get(segs[1]);
    let start = 2;
    if (!known && segs[2]) {
        known = IDENTIFIER_ROUTES.get(`${segs[1]}/${segs[2]}`);
        start = 3;
    }
    if (!known) return pathname;
    for (let i = start; i < segs.length; i++) {
        const seg = segs[i];
        if (!seg) continue; // 빈 세그먼트(끝 슬래시·중복 슬래시)
        if (known.has(seg)) continue; // 실제 존재하는 정적 하위 라우트
        if (/^\d+$/.test(seg)) continue; // 숫자는 아래 기존 규칙이 처리한다(값 불변)
        segs[i] = ':id';
    }
    return segs.join('/');
}

/** URL 경로를 게시판 단위로 그룹화(고카디널리티 방지). /free/123 → /free/:id */
export function pathGroup(pathname: string): string {
    return maskIdentifierSegments(pathname)
        .replace(/^\/([a-zA-Z0-9_-]+)\/\d+.*$/, '/$1/:id')
        .replace(/\/\d+/g, '/:n')
        .slice(0, 60);
}

/**
 * ⛔ **`page=` 는 이탈 시점 경로다 — 페이지별 비교의 기준이 될 수 없다.**
 *
 * CWV 는 `pagehide`/`visibilitychange(hidden)` 에서 **생애 최종값 1회**로 보고된다.
 * 그때의 `location.pathname` 은 SPA 이동을 거친 뒤라면 **마지막에 있던 경로**다.
 * 목록→글→뒤로 이동한 세션은 값이 세션 전체에 누적됐는데도 목록으로 태깅된다.
 *
 * 2026-08-24 실측: "모바일 `/free`(목록) CLS" 상위 타깃이 `#comments` ·
 * `#economy-post-content` · `footer` — **전부 글 상세 요소**였다.
 * 목록만 따로 열어 재면 CLS 0.0001 로 깨끗하다.
 *
 * → **랜딩 경로를 함께 싣는다.** 분석에서 `landing == page` 인 표본만 걸러야
 *   페이지별 비교가 성립한다. 그 전에는 페이지별 개선의 효과를 판정할 수 없다.
 *
 * ⛔ 모듈 로드 시점에 한 번만 읽는다. 나중에 읽으면 이미 이동한 뒤라 의미가 없다.
 * 비용: 초기화 시 `location.pathname` 읽기 1회 — 렌더 경로에 아무것도 추가하지 않는다.
 */
const landingPath = typeof window !== 'undefined' ? pathGroup(location.pathname) : '';

let installed = false;

export function initWebVitalsRum(): void {
    if (typeof window === 'undefined' || installed) return;
    installed = true;

    void import('web-vitals/attribution').then(({ onCLS, onLCP, onINP, onTTFB }) => {
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
            detail: string | undefined,
            clsEntry?: LayoutShiftEntryLike
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
            sendToDantry(name, v, t, g, detail ?? '?', clsEntry);
        };
        // 각 메트릭은 페이지 생애 최종값을 pagehide/visibilitychange(hidden) 시 1회 보고한다.
        // gtag 는 sendBeacon 으로 hidden 시점 플러시 → 언로드 유실 없음.
        // ⚠️ SPA soft-nav 는 미수집(installed 가드+web-vitals v6 옵션 미활성): 랜딩→이탈만 정확.
        //    사내 네비게이션은 LCP 를 hide 시점 경로로 오태깅하므로 분석 시 랜딩 필터 전제.
        // ⛔ 메트릭마다 attribution 필드 이름이 다르다. 느슨한 unknown 으로 받으면
        //    오필드를 조용히 숨겨 계측이 죽는다(2026-07-31 Evaluator 정정 이력).
        /**
         * ⛔ `largestShiftEntry` 는 web-vitals v6 의 **공개 attribution 필드**다
         *    (`node_modules/.pnpm/web-vitals@6.0.1/.../dist/modules/types/cls.d.ts:38`
         *     `largestShiftEntry?: LayoutShift;`). 타입 `LayoutShift` 는 lib.dom 에 없는
         *    전역이라 여기서는 이 파일이 직접 선언한 `LayoutShiftEntryLike` 로 좁혀 받는다.
         *    ⛔ web-vitals 는 `hadRecentInput` 엔트리를 애초에 세지 않으므로 여기 오는
         *       엔트리에는 그 계열이 없다 — 이게 CLS 를 오탭 대리지표로 못 쓰는 이유다.
         */
        onCLS((m) =>
            send(
                'CLS',
                m.value,
                m.attribution.largestShiftTarget,
                m.attribution.loadState,
                m.attribution.largestShiftEntry as unknown as LayoutShiftEntryLike | undefined
            )
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
        /**
         * TTFB — **사용자 체감의 시작점**이자 SSR 지연이 드러나는 유일한 실사용자 지표.
         *
         * 2026-08-20 에 DB 쿼리 CPU 를 실측했더니 12%(0.97코어/8vCPU)로 여유가 있었다.
         * 즉 다음 병목은 DB 가 아니라 **요청이 실제로 기다리는 곳**이고, 그걸 가르는 게
         * TTFB 의 단계별 attribution 이다.
         *
         * ⛔ target 자리에 **지배적인 단계 이름**을 넣는다. 다른 지표는 "범인 요소" 를
         *    넣는데, TTFB 는 요소가 없고 대신 "어느 구간이 제일 길었나" 가 범인이다.
         *    그래야 기존 target= 기준 집계 쿼리가 그대로 쓰인다.
         *   · request  = 오리진 처리(SSR·백엔드) — 우리가 고칠 수 있는 구간
         *   · waiting  = 요청 시작 전 대기(리다이렉트·워커·큐) — CDN/엣지 계열
         *   · dns/connection/cache = 연결 계열
         *
         * detail 에는 전 구간을 함께 실어 나중에 합산·분해가 되게 한다.
         */
        onTTFB((m) => {
            const a = m.attribution;
            const phases: ReadonlyArray<readonly [string, number]> = [
                ['waiting', a.waitingDuration],
                ['cache', a.cacheDuration],
                ['dns', a.dnsDuration],
                ['connection', a.connectionDuration],
                ['request', a.requestDuration]
            ];
            const dominant = phases.reduce((x, y) => (y[1] > x[1] ? y : x));
            send(
                'TTFB',
                m.value,
                dominant[0],
                phases.map(([k, v]) => `${k}=${Math.round(v)}`).join(',')
            );
        });
    });
}
