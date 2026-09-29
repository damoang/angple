/**
 * 유튜브 임베드 플레이어 아래 「YouTube에서 보기 ↗」 링크
 *
 * 단독 유튜브 링크가 플레이어로 바뀌면 원래 링크가 사라져, 유튜브 앱/사이트에서
 * 좋아요를 누르거나 주소를 복사할 수 없었다. 플레이어와 같은 HTML 문자열에
 * 링크를 함께 붙여, 플레이어가 나타나는 시점에 링크도 같이 나타나게 한다.
 *
 * - 링크는 <p> 가 아닌 <div> 안에 두고, 앵커 텍스트도 URL 이 아니므로
 *   단독 문단 변환(transformStandaloneYoutubeLinks)·auto-embed(processContent)가
 *   다시 플레이어로 바꾸지 않는다(변환이 두 번 돌아도 중복 생성 없음).
 * - 출력에는 검증된 11자 videoId 와 숫자 start 만 들어간다(XSS 안전).
 * - class/href/target/rel 은 본문·댓글 DOMPurify 설정에서 모두 허용된다.
 */

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

export const YOUTUBE_WATCH_LINK_CLASS = 'embed-source-link';

export interface YoutubeWatchLinkOptions {
    /** shorts 영상이면 /shorts/<ID> 로 연결 */
    isShorts?: boolean;
    /** 시작 시간(초) — watch 링크에 t=<초>s 로 유지 */
    start?: string | number | null;
}

/** 유튜브 원본 보기 URL. videoId 가 올바르지 않으면 null */
export function youtubeWatchUrl(
    videoId: string,
    opts: YoutubeWatchLinkOptions = {}
): string | null {
    if (!VIDEO_ID_RE.test(videoId)) return null;
    if (opts.isShorts) return `https://www.youtube.com/shorts/${videoId}`;
    let url = `https://www.youtube.com/watch?v=${videoId}`;
    const start = opts.start != null ? String(opts.start) : '';
    if (/^\d+$/.test(start) && Number(start) > 0) url += `&t=${start}s`;
    return url;
}

/** 플레이어 아래에 붙일 링크 HTML. videoId 가 올바르지 않으면 빈 문자열 */
export function youtubeWatchLinkHtml(videoId: string, opts: YoutubeWatchLinkOptions = {}): string {
    const url = youtubeWatchUrl(videoId, opts);
    if (!url) return '';
    const href = url.replace(/&/g, '&amp;');
    return `<div class="${YOUTUBE_WATCH_LINK_CLASS}"><a href="${href}" target="_blank" rel="noopener noreferrer">YouTube에서 보기 ↗</a></div>`;
}
