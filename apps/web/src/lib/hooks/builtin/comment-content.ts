/**
 * 댓글 콘텐츠 변환 Built-in Hook
 * {emo:}, [이미지URL], {video:} 패턴을 HTML로 변환
 */
import { registerHook } from '../registry';
import {
    transformEmoticons,
    transformBracketImages,
    transformVideos,
    transformCodeBlocks,
    transformBacktickCodeBlocks,
    transformInlineCode,
    transformInlineMarkdown,
    transformOembed,
    transformEscapedMedia,
    transformSpoilers
} from '$lib/utils/content-transform';
import { processContent } from '$lib/plugins/auto-embed';

/**
 * 댓글 콘텐츠 필터 초기화
 * comment_content 필터에 이모티콘, 대괄호 이미지, 동영상 변환 등록
 */
export function initCommentContent(): void {
    // 이스케이프된 <video>/<iframe> 태그 복원
    registerHook(
        'comment_content',
        (html: unknown) => transformEscapedMedia(html as string),
        0.5,
        'core',
        'filter'
    );

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

    // [code]...[/code] BBCode → <pre><code>
    registerHook(
        'comment_content',
        (html: unknown) => transformCodeBlocks(html as string),
        3,
        'core',
        'filter'
    );

    // [spoiler]...[/spoiler] BBCode → <details>
    registerHook(
        'comment_content',
        (html: unknown) => transformSpoilers(html as string),
        3.5,
        'core',
        'filter'
    );

    // ```lang\n...\n``` 백틱 코드 블록 → <pre><code>
    registerHook(
        'comment_content',
        (html: unknown) => transformBacktickCodeBlocks(html as string),
        4,
        'core',
        'filter'
    );

    // `code` 인라인 백틱 → <code> (블록 변환 이후 실행)
    registerHook(
        'comment_content',
        (html: unknown) => transformInlineCode(html as string),
        4.5,
        'core',
        'filter'
    );

    // **bold**, *italic*, ~~strike~~ 인라인 마크다운 (코드 블록 이후 실행)
    registerHook(
        'comment_content',
        (html: unknown) => transformInlineMarkdown(html as string),
        4.6,
        'core',
        'filter'
    );

    // CKEditor5 <oembed> 태그 → 임베드 플레이어
    registerHook(
        'comment_content',
        (html: unknown) => transformOembed(html as string),
        4.8,
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
