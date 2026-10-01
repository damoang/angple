/**
 * 어떤 응답에 Content-Security-Policy 헤더를 붙일지 정한다 (순수 함수).
 *
 * CSP 는 브라우저가 **문서를 렌더링할 때** 적용하는 정책이다. JSON 데이터 응답에는 효과가 없다.
 * 그런데 이 사이트의 CSP 는 약 2.8KB 이고, 모든 응답에 붙이면 본문이 수십 바이트인 API 응답도
 * 헤더만 3KB 를 넘는다. 하루 1천만 건이 넘는 데이터 응답에서 그만큼의 전송이 낭비된다.
 *
 * ⛔ 「붙이지 않을 유형」을 명시적으로 나열한다. 반대로(HTML 에만 붙이기) 하면 SVG·XML 처럼
 *    브라우저가 문서로 열어 스크립트를 실행할 수 있는 유형에서 정책이 빠진다.
 *    모르는 유형·유형 없음은 안전한 쪽(붙임)으로 간다.
 */
const DATA_ONLY_TYPES = new Set(['application/json', 'text/sveltekit-data']);

export function shouldSendCsp(contentType: string | null | undefined): boolean {
    if (!contentType) return true;
    const mime = contentType.split(';')[0].trim().toLowerCase();
    return !DATA_ONLY_TYPES.has(mime);
}
