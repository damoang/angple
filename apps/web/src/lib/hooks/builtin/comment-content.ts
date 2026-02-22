/**
 * 댓글 콘텐츠 변환 Built-in Hook
 * {emo:}, [이미지URL], {video:} 패턴을 HTML로 변환
 */
import { registerHook } from '../registry';
import {
    transformEmoticons,
    transformBracketImages,
    transformVideos
} from '$lib/utils/content-transform';
import { processContent } from '$lib/plugins/auto-embed';

/**
 * 댓글 콘텐츠 필터 초기화
 * comment_content 필터에 이모티콘, 대괄호 이미지, 동영상 변환 등록
 */
export function initCommentContent(): void {
    // 이모티콘 {emo:filename:size} → <img>
    registerHook(
        'comment_content',
        (html: unknown) => transformEmoticons(html as string),
        1,
        'core',
        'filter'
    );

    // 대괄호 이미지 [https://...jpg] → <img>
    registerHook(
        'comment_content',
        (html: unknown) => transformBracketImages(html as string),
        2,
        'core',
        'filter'
    );

    // 레거시 {video:} 패턴
    registerHook(
        'comment_content',
        (html: unknown) => transformVideos(html as string),
        5,
        'core',
        'filter'
    );

    // URL 자동 임베딩 (YouTube 등)
    registerHook(
        'comment_content',
        (html: unknown) => processContent(html as string),
        10,
        'core',
        'filter'
    );
}
