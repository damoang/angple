/**
 * 공개 수정 이력 — 게시판 목록과 비교용 평문 변환.
 *
 * 공개 대상 게시판은 백엔드 설정(PUBLIC_REVISION_BOARDS, 기본 claim)이 정한다. 웹은 같은 목록을 들고
 * 있다가 **그 밖의 게시판에서는 횟수 요청 자체를 하지 않는다**(다른 게시판 요청 증가 0).
 * 백엔드 목록을 넓히면 여기도 같이 넓힌다.
 */
import { stripEmailMarkers } from './email-reveal.js';

export const PUBLIC_REVISION_BOARDS: ReadonlySet<string> = new Set(['claim']);

export function isPublicRevisionBoard(boardId: string | null | undefined): boolean {
    return !!boardId && PUBLIC_REVISION_BOARDS.has(boardId);
}

/**
 * 본문 HTML → 줄 단위 비교용 평문. 이메일 표지는 「[이메일]」, 이미지는 「[이미지]」로 남긴다.
 * 브라우저에서는 DOMParser(스크립트·이미지를 실행/로드하지 않는 문서)로 엔티티까지 풀고,
 * 그 밖(SSR·테스트)에서는 태그만 걷어낸다.
 */
export function revisionPlainText(html: string): string {
    if (!html) return '';
    const withBreaks = html
        .replace(/<img\b[^>]*>/gi, '[이미지]')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n');
    let text: string;
    if (typeof DOMParser !== 'undefined') {
        text = new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent ?? '';
    } else {
        text = withBreaks.replace(/<[^>]*>/g, '');
    }
    return stripEmailMarkers(text)
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
