/**
 * 우리 자산 호스트를 가리키는 `<link>` 에 `crossorigin` 을 붙인다 — 모드 통일.
 *
 * ## ⛔ 왜 필요한가
 *
 * `import()` 는 규격상 **항상 CORS 모드**다. 반면 `<link rel="stylesheet">` 는
 * `crossorigin` 이 없으면 **no-CORS 모드**다. 즉 같은 호스트의 자산을 두 모드로 받는다.
 *
 * 단일 번들일 때 CSS 링크는 **1개**였다. 2026-09-30 코드 분할(#2327)을 켜자 **34개**가 되어
 * **모드 혼용 표면이 34배**가 됐고, 직후 실측에서 라우트 청크 로드 실패가 **엔진별로 갈렸다**:
 *
 *     Firefox     225 /1k   (Chrome 의 13.4배)
 *     iOS Safari  131 /1k
 *     iOS Chrome  127 /1k   ← iOS 는 전부 WebKit. 브랜드가 아니라 **엔진** 문제다
 *     Chrome       16.8/1k
 *     Edge          0  /1k
 *
 * ⭐ 2026-06 1차 split 실패의 신고가 **#12836 Firefox PC** 였다 — 지금 최악인 브라우저와 같다.
 *
 * ⛔ 기각된 가설: 구 HTML 전이(실패 URL 이 전부 현 릴리스) · 봇 오염(제외해도 동일) ·
 *    엣지 캐시 콜드(ICN 148개 데운 뒤에도 그대로) · 청크 서빙 장애(200·ACAO `*`).
 *
 * ## ⛔ 안전 근거 — 캐시 충돌이 구조적으로 불가능하다
 *
 * 「브라우저가 no-CORS 로 받아둔 CSS 를 CORS 요청이 재사용해 차단된다」(9월 사고의 역방향)는
 * 걱정이 자연스럽다. 그러나 자산 URL 은 `releases/<tag>/` 를 포함해 **릴리스마다 다르다.**
 * 이 변경은 새 릴리스로 나가므로 그 URL 들은 **처음부터 CORS 모드로만** 요청된다.
 *
 * ## ⛔ 전제
 *
 * 자산 응답이 `ACAO: *` 여야 한다. 아니면 **CSS 가 아예 적용되지 않는다**(무스타일 페이지).
 * 그래서 `triage/tools/acao_watch.py` 가 10분마다 ACAO 와 참조 모드 혼용을 감시한다.
 *
 * 설계서: /home/angple/docs/2026-09-30-crossorigin-unify-sprint.html
 */

/** `<link ...>` 한 개를 잡는다. 속성 안의 `>` 는 우리 HTML 에 없다(따옴표 안에도). */
const LINK_TAG = /<link\b[^>]*>/gi;
/** 속성으로서의 crossorigin — URL 안에 그 문자열이 있는 경우와 구별한다 */
const HAS_CROSSORIGIN = /\scrossorigin(?=[\s=>/])/i;

/**
 * @param html SSR HTML
 * @param assetBase 자산 기준 URL (예: https://static.damoang.net/releases/sha-x). 빈 값이면 그대로 반환
 */
export function addAssetCrossorigin(html: string, assetBase: string): string {
    if (!assetBase) return html;
    let origin: string;
    try {
        origin = new URL(assetBase).origin;
    } catch {
        return html; // ⛔ 잘못된 기준 URL 로 HTML 을 망치지 않는다
    }
    return html.replace(LINK_TAG, (tag) => {
        // 우리 호스트가 아닌 것은 손대지 않는다 — jsdelivr·turnstile 은 이미 맞춰져 있고
        // ACAO 정책이 다르다.
        if (!tag.includes(origin)) return tag;
        // 멱등 — 이미 있으면 두 번 붙이지 않는다
        if (HAS_CROSSORIGIN.test(tag)) return tag;
        return /\/>$/.test(tag)
            ? tag.replace(/\s*\/>$/, ' crossorigin />')
            : tag.replace(/\s*>$/, ' crossorigin>');
    });
}
