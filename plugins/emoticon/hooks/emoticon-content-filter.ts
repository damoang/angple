/**
 * 이모티콘 게시글 본문 필터
 * post_content 필터에 등록하여 {emo:...} 코드를 <img> 태그로 변환
 */

import { replaceEmoticons } from '../lib/parser';
import { getApiBaseUrl } from '../lib/api';

/**
 * 게시글 본문에서 이모티콘 코드를 이미지로 변환하는 필터 콜백
 *
 * @param content - 게시글 본문 HTML
 * @returns 이모티콘이 렌더링된 HTML
 */
export default function emoticonContentFilter(content: string): string {
    if (!content) return content;
    return replaceEmoticons(content, getApiBaseUrl());
}
