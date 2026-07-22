/**
 * 앙지도(angmap) 지도 링크 감지/정규화 — 순수 함수 (클라이언트/서버 공용)
 *
 * 작성폼(클라이언트)의 링크 감지와 서버 resolve 프록시($lib/server/angmap-resolve.ts)가
 * 함께 사용한다. fetch 등 부작용 없음 — vitest 순수 테스트 대상.
 *
 * 별도 백필(resolver) 트랙과 파싱 로직 통합 시 이 모듈을 기준으로 맞춘다.
 */

/**
 * 지원하는 지도 링크 호스트 (감지 + 서버 SSRF 가드 겸용).
 * 이 목록 밖의 호스트는 감지하지도, 서버에서 따라가지도 않는다.
 */
export const MAP_LINK_HOSTS: readonly string[] = [
    // 네이버
    'naver.me',
    'map.naver.com',
    'm.map.naver.com',
    'm.place.naver.com',
    'place.naver.com',
    // 카카오
    'kko.to',
    'place.map.kakao.com',
    'map.kakao.com',
    'applink.map.kakao.com',
    // 구글 (google.com 계열은 /maps 경로만 인정 — isSupportedMapUrl 참고)
    'maps.app.goo.gl',
    'goo.gl',
    'google.com',
    'www.google.com',
    'maps.google.com'
];

/** 본문/필드에서 URL 후보를 찾는 패턴 (한글·공백·따옴표·태그 경계에서 끊는다) */
const URL_PATTERN = /https?:\/\/[^\s<>"'가-힣ㄱ-ㆎ]+/g;

/**
 * 지도 URL 정규화.
 * - zero-width 문자 제거 (실측: kko.to 링크 끝에 U+200B가 붙어 있던 사례)
 * - HTML 엔티티 `&amp;` 복원 (본문 HTML에서 추출된 경우)
 * - 문장 끝에 따라붙은 구두점/닫는 괄호 제거
 */
export function normalizeMapUrl(raw: string): string {
    let url = raw
        .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
        .replace(/&amp;/g, '&')
        .trim();
    url = url.replace(/[)\]}>.,;:!?'"…]+$/, '');
    return url;
}

/** URL이 지원 대상 지도 링크인지 판별 (프로토콜 + 호스트 allowlist) */
export function isSupportedMapUrl(u: URL): boolean {
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    // google.com 계열은 지도 경로만 인정 (검색/일반 링크 오탐 방지)
    if (host === 'google.com' || host === 'www.google.com' || host === 'maps.google.com') {
        return u.pathname.startsWith('/maps');
    }
    if (host === 'goo.gl') {
        return u.pathname.startsWith('/maps');
    }
    return MAP_LINK_HOSTS.includes(host);
}

/**
 * 텍스트(플레인/HTML)에서 첫 번째 지원 지도 링크를 찾아 정규화해 돌려준다.
 * 없으면 null.
 */
export function findMapLink(text: string): string | null {
    if (!text) return null;
    const matches = text.match(URL_PATTERN);
    if (!matches) return null;
    for (const raw of matches) {
        const normalized = normalizeMapUrl(raw);
        try {
            const u = new URL(normalized);
            if (isSupportedMapUrl(u)) return normalized;
        } catch {
            // URL 파싱 실패 — 다음 후보로
        }
    }
    return null;
}
