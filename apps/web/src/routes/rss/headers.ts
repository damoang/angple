import { createHash } from 'crypto';

/**
 * RSS 조건부 응답(ETag / 304).
 *
 * ⛔ `Cache-Control` 과 `Vary` 는 건드리지 않는다. 라우트가 `public, s-maxage=…` 를 줘 봐야
 *    `/rss` 는 호스트 nginx 가 `proxy_hide_header Cache-Control` 로 벗기고,
 *    두 피드 모두 Cloudflare 캐시 규칙이 없어 `s-maxage` 가 먹지 않는다(2026-08-31 실측).
 *    엣지 캐시를 제대로 하려면 nginx·CF 까지 같은 변경 세트로 가야 하므로 별건으로 미룬다.
 *
 * ⭐ ETag 는 그 전부와 무관하게 동작한다. 훅이 주는 `max-age=2, must-revalidate` 때문에
 *    피드 리더는 어차피 매번 재검증하는데, 지금은 그때마다 14.7KB 본문을 새로 만들어 보낸다.
 *    ETag 가 있으면 내용이 안 바뀐 동안은 **본문 없이 304** 로 끝난다.
 *
 * ⛔ `Last-Modified`(최신 글 시각)를 쓰지 않는 이유: 글이 **삭제되거나 수정**되면 그 시각이
 *    내려가거나 그대로여서, 독자가 자기 시각보다 더 새 글이 올라올 때까지 304 에 갇힌다.
 *    글 간격이 긴 보드는 그 갇힘이 1~2.4일이다(실측: claim 56.6h · lecture 45.5h · angmap 41.2h).
 *    본문 해시는 삭제·수정·이용제한 마스킹 무엇이든 반영하므로 그 고장 모드가 없다.
 */
export function rssEtag(xml: string): string {
    return `"${createHash('sha1').update(xml).digest('base64url')}"`;
}

/** `If-None-Match` 가 현재 ETag 와 같으면 304 로 끝낸다. */
export function etagMatches(request: Request, etag: string): boolean {
    const inm = request.headers.get('if-none-match');
    if (!inm) return false;
    // 다중 값(`"a", "b"`)과 weak 접두사(`W/`)를 모두 받아준다.
    return inm
        .split(',')
        .map((v) => v.trim().replace(/^W\//, ''))
        .includes(etag);
}

/** 200·304 가 함께 쓰는 헤더. ⛔ Cache-Control 은 훅이 정한다 — 여기서 넣지 않는다. */
export function rssHeaders(etag: string): HeadersInit {
    return {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        ETag: etag
    };
}
