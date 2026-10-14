/**
 * 위키 본문 렌더·저장용 HTML 처리
 *
 * 위키 본문은 게시글 본문과 같은 정화 함수(sanitizePostContentStrict)를 거친다.
 * 새 허용 목록을 만들지 않고 게시글 허용 목록을 그대로 쓴다.
 *
 * 렌더는 서버 load 에서 한 번만 수행해 문자열로 내려보낸다. 그래서 SSR 과
 * 클라이언트 하이드레이션·내비게이션이 같은 문자열을 그린다.
 */
import { Marked } from 'marked';
import { sanitizePostContentStrict } from './sanitize';

/** 위키 본문 형식 */
export type WikiContentType = 'markdown' | 'html' | 'wikitext';

const WIKI_CONTENT_TYPES: readonly WikiContentType[] = ['markdown', 'html', 'wikitext'];

// 전역 marked 설정을 건드리지 않도록 위키 전용 인스턴스 (GFM + 줄바꿈)
const wikiMarked = new Marked({ gfm: true, breaks: true });

/**
 * 요청으로 들어온 content_type 을 허용 값으로 정규화한다. 모르는 값은 'html'.
 */
export function normalizeWikiContentType(value: unknown): WikiContentType {
    return typeof value === 'string' && (WIKI_CONTENT_TYPES as readonly string[]).includes(value)
        ? (value as WikiContentType)
        : 'html';
}

/**
 * 위키 본문을 화면에 그릴 HTML 로 변환한다.
 * markdown 은 HTML 로 변환한 뒤, 그 외 형식은 그대로 정화 함수를 거친다.
 */
export function renderWikiContent(
    content: string | null | undefined,
    contentType: string | null | undefined
): string {
    if (!content) return '';

    const html = contentType === 'markdown' ? wikiMarked.parse(content, { async: false }) : content;

    return sanitizePostContentStrict(html);
}

/**
 * 저장 직전 본문 처리.
 * HTML 형식(및 wikitext)은 정화한 결과를 저장한다. markdown 원문은 정화하면
 * `>`·`<` 같은 문법 기호가 엔티티로 바뀌어 원문이 깨지므로 그대로 두고,
 * 렌더할 때 renderWikiContent 경로에서 정화한다.
 */
export function prepareWikiContentForSave(content: unknown, contentType: WikiContentType): string {
    if (typeof content !== 'string' || !content) return '';
    if (contentType === 'markdown') return content;
    return sanitizePostContentStrict(content);
}
