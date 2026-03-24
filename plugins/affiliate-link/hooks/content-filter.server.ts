/**
 * 제휴 링크 자동 변환 콘텐츠 필터
 * post_content, comment_content 필터에 등록
 */

import { convertAffiliateLinks } from '../lib/affiliate-api.server';

interface FilterContext {
    bo_table?: string;
    wr_id?: number;
}

/**
 * 게시글/댓글 본문에서 링크를 제휴 링크로 변환하는 필터 콜백
 *
 * @param content - 본문 HTML
 * @param context - 게시판, 글 ID 등 컨텍스트
 * @returns 제휴 링크가 적용된 HTML
 */
export default async function affiliateLinkContentFilter(
    content: string,
    context?: FilterContext
): Promise<string> {
    if (!content) return content;

    try {
        return await convertAffiliateLinks(content, context?.bo_table, context?.wr_id);
    } catch (error) {
        console.error('[AffiliateLink] 콘텐츠 필터 오류:', error);
        return content;
    }
}
