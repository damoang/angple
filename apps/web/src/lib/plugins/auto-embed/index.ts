/**
 * URL 자동 임베딩 플러그인
 *
 * 게시글 본문, 댓글 등에서 지원 플랫폼의 URL을 자동으로 임베딩합니다.
 *
 * 지원 플랫폼:
 * - YouTube (일반, Shorts, Live, 재생목록)
 * - Vimeo
 * - Instagram (포스트, 릴스)
 * - Twitter/X
 * - Twitch (클립, VOD, 라이브)
 * - TikTok
 *
 * @example
 * ```typescript
 * import { processContent, embedUrl, isEmbeddable } from '$lib/plugins/auto-embed';
 *
 * // HTML 콘텐츠 처리
 * const html = processContent(rawHtml);
 *
 * // 단일 URL 임베딩
 * const embedHtml = embedUrl('https://youtube.com/watch?v=dQw4w9WgXcQ');
 *
 * // 임베딩 가능 여부 확인
 * if (isEmbeddable(url)) { ... }
 * ```
 */

// 타입 내보내기
export type { EmbedInfo, EmbedPlatform, EmbedResult } from './types.js';

// 핵심 함수 내보내기
export {
    processContent,
    embedUrl,
    getEmbed,
    getEmbedInfo,
    extractEmbeddableUrls,
    isEmbeddable,
    wrapEmbedHtml
} from './embedder.js';

// 플랫폼 내보내기
export { platforms, getPlatform, findPlatform } from './platforms/index.js';

// 컴포넌트 내보내기
export { default as EmbedContainer } from './components/EmbedContainer.svelte';

/**
 * CSS 스타일 (전역에서 import 필요)
 */
export const embedStyles = `
.embed-container {
	position: relative;
	width: 100%;
	max-width: var(--max-width, 100%);
	margin: 1rem 0;
}

.embed-container::before {
	content: '';
	display: block;
	padding-bottom: var(--aspect-ratio, 56.25%);
}

.embed-container iframe,
.embed-container video,
.embed-container audio {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	border: 0;
	border-radius: 0.5rem;
}

/* 세로 영상 */
.embed-container[data-platform="youtube-shorts"],
.embed-container[data-platform="instagram-reel"],
.embed-container[data-platform="tiktok"] {
	margin-left: auto;
	margin-right: auto;
}

/* Twitter 가변 높이 */
.embed-container[data-platform="twitter"] {
	min-height: 250px;
}

.embed-container[data-platform="twitter"]::before {
	display: none;
}

.embed-container[data-platform="twitter"] iframe {
	position: relative;
	min-height: 250px;
	height: auto;
}
`;
