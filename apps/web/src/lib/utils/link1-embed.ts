/**
 * link1 (그누보드 wr_link1) 자동 동영상 임베드 헬퍼.
 *
 * 게시글 본문 위에 link1 동영상이 자동 삽입될 때, auto-embed 플러그인이 만드는
 * `<div class="embed-container" data-platform="youtube">…</div>` 마크업과
 * 에디터(TipTap)가 직접 삽입한 `<div data-youtube-video><iframe class="tiptap-youtube">…</iframe></div>`
 * 마크업의 시각적 차이를 없애기 위해, link1 자동 임베드를 TipTap 형식으로 통일한다.
 *
 * 관련 버그: damoang.net 버그 게시판 #12111
 */

const YOUTUBE_ID_REGEX =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

/**
 * URL 이 YouTube 동영상이면 TipTap Youtube extension 과 동일한 마크업으로 변환.
 * YouTube 가 아니면 null 반환 → 호출 측이 기존 auto-embed 경로로 위임하면 됨.
 */
export function embedAsTiptapYoutube(url: string): string | null {
    if (!url) return null;
    const m = url.match(YOUTUBE_ID_REGEX);
    if (!m) return null;
    const vid = m[1];
    return `<div data-youtube-video=""><iframe class="tiptap-youtube" width="640" height="480" allowfullscreen="true" src="https://www.youtube.com/embed/${vid}"></iframe></div>`;
}
