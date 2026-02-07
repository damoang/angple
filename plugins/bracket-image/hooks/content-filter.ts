/**
 * 숏코드 게시글 본문 필터
 * post_content 필터에 등록하여 [img URL], {video:URL} 등을 HTML로 변환
 */

import { processBracketShortcodes } from '../lib/shortcode-parser';

/**
 * 게시글 본문에서 숏코드를 HTML로 변환하는 필터 콜백
 *
 * @param content - 게시글 본문 HTML
 * @returns 숏코드가 렌더링된 HTML
 */
export default function bracketImageContentFilter(content: string): string {
    if (!content) return content;
    return processBracketShortcodes(content);
}
