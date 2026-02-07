/**
 * 이모티콘 댓글 본문 필터
 * comment_content 필터에 등록하여 {emo:...} 코드를 <img> 태그로 변환
 */

import { replaceEmoticons } from '../lib/parser';

/**
 * 댓글 본문에서 이모티콘 코드를 이미지로 변환하는 필터 콜백
 *
 * @param content - 댓글 본문 HTML
 * @returns 이모티콘이 렌더링된 HTML
 */
export default function emoticonCommentFilter(content: string): string {
    if (!content) return content;
    return replaceEmoticons(content);
}
