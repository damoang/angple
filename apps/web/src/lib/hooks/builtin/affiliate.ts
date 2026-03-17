/**
 * 제휴 링크 자동 변환 Hook (서버사이드)
 *
 * post_content / comment_content 필터에 등록하여
 * 본문/댓글의 쇼핑 링크를 수익링크로 자동 변환합니다.
 *
 * 이 hook은 서버사이드에서만 동작하며 (+page.server.ts에서 직접 호출),
 * 클라이언트 hook 시스템과는 별도로 작동합니다.
 */

import { convertAffiliateLinks } from '$plugins/affiliate-link/lib/affiliate-api.server';

/**
 * HTML 콘텐츠 내 제휴 링크 변환
 *
 * @param html - 변환할 HTML 콘텐츠
 * @param context - 게시판/게시글 컨텍스트
 * @returns 수익링크로 변환된 HTML
 */
export async function transformAffiliateContent(
    html: string,
    context?: { bo_table?: string; wr_id?: number }
): Promise<string> {
    if (!html) return html;

    try {
        return await convertAffiliateLinks(html, context?.bo_table, context?.wr_id);
    } catch (error) {
        console.error('[Affiliate Hook] 변환 오류:', error);
        return html; // 오류 시 원본 반환
    }
}
