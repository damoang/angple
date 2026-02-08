/**
 * URL 자동 임베딩 핵심 로직
 */

import type { EmbedInfo, EmbedResult } from './types.js';
import { platforms } from './platforms/index.js';

/**
 * URL에서 임베드 정보 추출
 */
export function getEmbedInfo(url: string): EmbedInfo | null {
    for (const platform of platforms) {
        const info = platform.extract(url);
        if (info) {
            return info;
        }
    }
    return null;
}

/**
 * URL을 임베드 HTML로 변환
 */
export function getEmbed(url: string): EmbedResult {
    for (const platform of platforms) {
        const info = platform.extract(url);
        if (info) {
            const html = platform.render(info);
            return {
                success: true,
                info,
                html
            };
        }
    }
    return { success: false };
}

/**
 * 임베드 정보를 컨테이너 HTML로 래핑
 */
export function wrapEmbedHtml(info: EmbedInfo, innerHtml: string): string {
    const aspectRatio = info.aspectRatio || 56.25;
    const maxWidth = info.maxWidth ? `${info.maxWidth}px` : '100%';
    const platform = info.platform;

    return `<div class="embed-container" data-platform="${platform}" style="--aspect-ratio: ${aspectRatio}%; --max-width: ${maxWidth};">
		${innerHtml}
	</div>`;
}

/**
 * 단일 URL을 임베드로 변환 (컨테이너 포함)
 */
export function embedUrl(url: string): string | null {
    const result = getEmbed(url);
    if (result.success && result.info && result.html) {
        return wrapEmbedHtml(result.info, result.html);
    }
    return null;
}

/**
 * HTML 콘텐츠 내 URL을 임베드로 변환
 *
 * 변환 규칙:
 * 1. <a> 태그의 href와 텍스트가 동일한 URL 링크는 임베드로 변환
 *    (에디터가 자동 링크 처리한 경우: <a href="URL">URL</a>)
 * 2. 줄 단독으로 있는 plain URL도 임베드로 변환
 * 3. 문장 중간의 URL은 변환하지 않음
 */
export function processContent(html: string): string {
    // 1단계: <a> 태그로 감싸진 URL 처리 (그누보드 에디터 자동 링크)
    // href와 텍스트가 동일한 경우만 임베드로 변환
    const aTagPattern =
        /<a\s[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>\s*(https?:\/\/[^\s<]+?)\s*<\/a>/gi;

    let result = html.replace(aTagPattern, (match, href, text) => {
        // href와 텍스트 URL이 실질적으로 같은지 확인
        const cleanHref = href.trim().replace(/\/+$/, '');
        const cleanText = text.trim().replace(/\/+$/, '');
        if (cleanHref !== cleanText) {
            return match; // 커스텀 텍스트 링크는 유지
        }

        const embedded = embedUrl(href.trim());
        if (embedded) {
            return embedded;
        }
        return match;
    });

    // 2단계: plain URL 처리 (기존 로직)
    const urlPattern = /(<p>|<br\s*\/?>|\n|^)\s*(https?:\/\/[^\s<>"]+)\s*(<\/p>|<br\s*\/?>|\n|$)/gi;

    result = result.replace(urlPattern, (match, prefix, url, suffix) => {
        const embedded = embedUrl(url.trim());
        if (embedded) {
            return (prefix || '') + embedded + (suffix || '');
        }
        return match;
    });

    return result;
}

/**
 * 텍스트에서 모든 임베딩 가능한 URL 추출
 */
export function extractEmbeddableUrls(text: string): EmbedInfo[] {
    const urlPattern = /https?:\/\/[^\s<>"]+/g;
    const matches = text.match(urlPattern) || [];
    const results: EmbedInfo[] = [];

    for (const url of matches) {
        const info = getEmbedInfo(url);
        if (info) {
            results.push(info);
        }
    }

    return results;
}

/**
 * URL이 임베딩 가능한지 확인
 */
export function isEmbeddable(url: string): boolean {
    return getEmbedInfo(url) !== null;
}
