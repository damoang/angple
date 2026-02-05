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
 * 1. <a> 태그로 감싸진 URL은 무시 (이미 링크됨)
 * 2. 줄 단독으로 있는 URL만 임베드로 변환
 * 3. 문장 중간의 URL은 변환하지 않음
 */
export function processContent(html: string): string {
    // URL 패턴: 줄의 시작 또는 공백 이후에 나오는 URL
    // <a> 태그 내부가 아닌 URL만 매칭
    const urlPattern =
        /(?:^|\n|<br\s*\/?>|<p>)\s*(https?:\/\/[^\s<>"]+)\s*(?:\n|<br\s*\/?>|<\/p>|$)/gi;

    return html.replace(urlPattern, (match, url) => {
        const embedded = embedUrl(url.trim());
        if (embedded) {
            // 앞뒤 줄바꿈 유지
            const prefix =
                match.startsWith('\n') || match.startsWith('<br') || match.startsWith('<p>')
                    ? match.match(/^[^\w]*/)?.[0] || ''
                    : '';
            const suffix =
                match.endsWith('\n') || match.endsWith('<br>') || match.endsWith('</p>')
                    ? match.match(/[^\w]*$/)?.[0] || ''
                    : '';
            return prefix + embedded + suffix;
        }
        return match; // 임베딩 불가 시 원본 유지
    });
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
