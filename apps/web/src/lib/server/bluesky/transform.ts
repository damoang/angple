/**
 * Bluesky handle → DID 본문 치환 (server-only)
 *
 * 본문 HTML 에서 `bsky.app/profile/<handle>/post/<id>` 패턴을 모두 추출해
 * handle 을 DID 로 일괄 변환한 뒤 URL 을 치환한다. SSR content-transform 직전
 * 호출하면 이후 `bluesky.ts` 의 embedder 가 DID 기반 URL 을 받아 정상 임베드를
 * 생성한다.
 *
 * 동작 원칙:
 *   - 이미 `did:` 로 시작하는 identifier 는 건너뜀 (regression 방지).
 *   - resolve 가 null 을 반환하면 원본 URL 보존 (UX 악화 없음).
 *   - 동일 handle 중복 호출 없이 unique set 만 병렬 resolve.
 *
 * Bug: damoang.net #12050
 */
import { resolveBlueskyHandle } from './resolver.js';

/**
 * `bsky.app/profile/<identifier>/post/<rkey>` 매칭.
 * - 선행 슬래시(`/`) 없음 → 도메인 직전 텍스트와 무관하게 동작
 * - identifier: `[^/\s"'<>]+` (URL 안전 문자만, HTML 어트리뷰트 경계 보호)
 * - rkey: `[\w]+`
 */
const BSKY_POST_URL_RE = /bsky\.app\/profile\/([^/\s"'<>]+)\/post\/(\w+)/g;

function isAlreadyDID(identifier: string): boolean {
    return identifier.startsWith('did:');
}

/**
 * HTML 본문에서 Bluesky handle URL 을 발견해 DID URL 로 치환.
 *
 * @param html 원본 HTML.
 * @returns 치환된 HTML. handle 매칭이 없거나 모두 resolve 실패해도 안전하게
 *   원본을 유지한 결과를 반환.
 */
export async function prefetchBlueskyDIDs(html: string): Promise<string> {
    if (!html || typeof html !== 'string') return html;

    // 1. 본문 내 모든 매칭 수집 + handle 만 unique 추출.
    const handles = new Set<string>();
    let match: RegExpExecArray | null;
    BSKY_POST_URL_RE.lastIndex = 0;
    while ((match = BSKY_POST_URL_RE.exec(html)) !== null) {
        const identifier = match[1];
        if (!isAlreadyDID(identifier)) {
            handles.add(identifier);
        }
    }

    if (handles.size === 0) return html;

    // 2. 병렬 resolve. 각 handle 별 결과를 Map 에 저장.
    const handleList = Array.from(handles);
    const dids = await Promise.all(handleList.map((h) => resolveBlueskyHandle(h)));
    const resolved = new Map<string, string>();
    handleList.forEach((h, i) => {
        const did = dids[i];
        if (did) resolved.set(h, did);
    });

    if (resolved.size === 0) return html;

    // 3. 본문 치환. 새 RegExp 인스턴스로 lastIndex 안전 보장.
    return html.replace(
        /bsky\.app\/profile\/([^/\s"'<>]+)\/post\/(\w+)/g,
        (full, identifier: string, rkey: string) => {
            if (isAlreadyDID(identifier)) return full;
            const did = resolved.get(identifier);
            if (!did) return full;
            return `bsky.app/profile/${did}/post/${rkey}`;
        }
    );
}
