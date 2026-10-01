/**
 * 카나리 검사의 **셸·CSS 판정** — 순수 함수. `shellProbe()` 결과를 받아 실패 목록을 돌려준다.
 *
 * ## ⛔ 왜 CSS 축이 필요한가
 *
 * 2026-09-30 코드 분할 반영 후 회원이 **bug/14049** 로 「목록이 스타일 덜 먹은 표 형태」를
 * 신고했다. 그런데 그때 검사는 **PASS** 였다 — 셸 요소(header·#app-root)는 다 있고 콘솔 오류도
 * 없었기 때문이다. 재로드율 지표에도 안 잡혔다(**재로드 없이 깨진 화면**이므로).
 * ⛔ 그래서 「Edge·Android 는 거의 멀쩡」이라고 잘못 보고했고, 실제 피해는 그 브라우저들에 있었다.
 *
 * ⭐ 탐지 원리: **로드에 실패한 `<link rel=stylesheet>` 는 `document.styleSheets` 에 들어가지 않는다.**
 * 「HTML 의 우리 CSS 링크 수」와 「실제로 올라온 스타일시트 수」의 차이가 곧 그 증상이다.
 *
 * ⛔ 판정하지 않는 경우 둘 — 오탐을 만들지 않기 위해:
 *   · `cssLoaded === -1` : `document.styleSheets` 접근 자체가 막힌 경우
 *   · `cssLinks === 0`   : 우리 CSS 링크가 없는 페이지 형태를 실패로 몰지 않는다
 *
 * ⛔ 이 함수를 `canary-browser-check.mjs` 안에 두면 단위 시험이 불가능하다
 *    (그 파일은 top-level await 로 즉시 실행된다). 그래서 분리했다.
 */

/**
 * @param {string} path 검사 중인 경로 (`/`, `/free`, `/free/123`, 또는 SPA 시나리오의 대표값)
 * @param {{header?:boolean, appRoot?:boolean, postLinks?:number, proseLen?:number,
 *          cssLinks?:number, cssLoaded?:number, evalError?:string}} sh shellProbe 결과
 * @returns {string[]} 실패 이유 목록 (빈 배열이면 통과)
 */
export function shellFails(path, sh) {
    const f = [];
    if (!sh) return ['셸 프로브 결과 없음'];
    if (sh.evalError) return [`셸 프로브 실패: ${sh.evalError}`];
    if (!sh.header) f.push('header 없음');
    if (!sh.appRoot) f.push('#app-root 없음');
    if (path === '/free' && (sh.postLinks ?? 0) < 5) f.push(`목록 링크 ${sh.postLinks ?? 0}개(<5)`);
    // ⛔ 글자 수만 보면 사진 글을 「본문 없음」으로 오탐한다. 2026-10-01 에 목록 맨 위가
    //    4자짜리 이미지 글이라 verify-canary 가 두 번 연속 실패했다(운영에서도 4자인 정상 글).
    //    본문이 비었다고 보려면 **글자도 적고 미디어도 없어야** 한다.
    if (/^\/free\/\d+/.test(path) && (sh.proseLen ?? 0) < 20 && (sh.proseMedia ?? 0) < 1) {
        f.push(`본문 ${sh.proseLen ?? 0}자(<20)·미디어 0`);
    }
    // 🔴 CSS 적용 판정 — bug/14049 를 잡는 축
    const links = sh.cssLinks ?? 0;
    const loaded = sh.cssLoaded ?? -1;
    if (links > 0 && loaded >= 0 && loaded < links) {
        f.push(`CSS 미적용 ${links - loaded}/${links}개 (link 있으나 styleSheets 에 없음)`);
    }
    return f;
}
