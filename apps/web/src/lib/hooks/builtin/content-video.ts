/**
 * 레거시 {video:} / {동영상:} 패턴 변환 Built-in Hook
 * 나리야(PHP) 호환 동영상 삽입 문법을 HTML 플레이어로 변환
 */
import { registerHook } from '../registry';
import {
    transformVideos,
    transformStandaloneYoutubeLinks,
    transformCodeBlocks,
    transformOembed,
    transformEscapedMedia,
    transformSpoilers,
    transformEmoticons,
    transformBracketImages
} from '$lib/utils/content-transform';

/**
 * 동영상 패턴 변환 필터 초기화
 * post_content 필터에 등록 (auto-embed보다 먼저 실행: priority 5)
 */
export function initContentVideo(): void {
    // 이스케이프된 <video>/<iframe> 태그 복원 (가장 먼저 실행)
    registerHook(
        'post_content',
        (html: unknown) => transformEscapedMedia(html as string),
        2, // 모든 변환보다 먼저 실행
        'core',
        'filter'
    );

    // CKEditor5 <oembed> 태그 → 임베드 플레이어
    registerHook(
        'post_content',
        (html: unknown) => transformOembed(html as string),
        4, // {video:}(5), auto-embed(10)보다 먼저 실행
        'core',
        'filter'
    );

    registerHook(
        'post_content',
        (html: unknown) => transformVideos(html as string),
        5, // auto-embed(10)보다 먼저 실행
        'core',
        'filter'
    );

    // 본문 단독 유튜브 링크 자동 임베드 복원 (구 나리야 자동임베드 동작 복원)
    // GSC "동영상이 보기 페이지에 없음" 1,000건+ 대응 — 옛 글의 <p><a href="유튜브"> 단독
    // 문단을 플레이어로 변환. {video:}(5) 이후, auto-embed(10) 이전에 실행
    registerHook(
        'post_content',
        (html: unknown) => transformStandaloneYoutubeLinks(html as string),
        6,
        'core',
        'filter'
    );

    // [code]...[/code] BBCode → <pre><code>
    registerHook(
        'post_content',
        (html: unknown) => transformCodeBlocks(html as string),
        3, // 동영상(5), auto-embed(10)보다 먼저 실행
        'core',
        'filter'
    );

    // [spoiler]...[/spoiler] BBCode → <details>
    registerHook(
        'post_content',
        (html: unknown) => transformSpoilers(html as string),
        3.5,
        'core',
        'filter'
    );

    // 이모티콘 {emo:filename:size} → <img>
    registerHook(
        'post_content',
        (html: unknown) => transformEmoticons(html as string),
        1,
        'core',
        'filter'
    );

    // 대괄호 이미지 [https://...jpg] → <img>
    registerHook(
        'post_content',
        (html: unknown) => transformBracketImages(html as string),
        1.5,
        'core',
        'filter'
    );
}
