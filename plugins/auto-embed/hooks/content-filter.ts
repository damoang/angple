/**
 * URL 자동 임베딩 게시글 본문 필터
 * post_content 필터에 등록하여 bare URL을 임베드로 변환
 */

import { processContent } from '../lib/embed-engine';

/**
 * 게시글 본문에서 URL을 임베드로 변환하는 필터 콜백
 *
 * @param content - 게시글 본문 HTML
 * @returns URL이 임베드된 HTML
 */
export default function autoEmbedContentFilter(content: string): string {
    if (!content) return content;
    return processContent(content);
}
