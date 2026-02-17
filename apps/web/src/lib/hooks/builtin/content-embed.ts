/**
 * 콘텐츠 임베딩 Built-in Hook
 * 게시글 본문의 동영상 URL을 자동으로 임베드 플레이어로 변환
 */
import { registerHook } from '../registry';
import { processContent } from '$lib/plugins/auto-embed';

/**
 * 콘텐츠 임베딩 필터 초기화
 * post_content 필터에 auto-embed 처리를 등록
 */
export function initContentEmbed(): void {
    registerHook(
        'post_content',
        (html: unknown) => processContent(html as string),
        10,
        'core',
        'filter'
    );
}
