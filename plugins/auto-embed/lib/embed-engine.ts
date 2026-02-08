/**
 * URL 자동 임베딩 핵심 로직
 */

import type { EmbedInfo, EmbedResult } from './types';
import { platforms } from './platforms/index';

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

    return `<div class="embed-container" data-platform="${platform}" style="--aspect-ratio: ${aspectRatio}%; --max-width: ${maxWidth};">${innerHtml}</div>`;
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
 * 1. 줄 단독으로 있는 bare URL → 임베드로 변환
 * 2. marked autolink로 <a> 태그가 된 URL도 단독 라인이면 변환
 * 3. 문장 중간의 URL은 변환하지 않음
 */
export function processContent(html: string): string {
    let result = html;

    // 1) bare URL (marked autolink 안 된 경우 — 댓글 등)
    const bareUrlPattern =
        /(<p>|<br\s*\/?>|\n|^)\s*(https?:\/\/[^\s<>"]+)\s*(<\/p>|<br\s*\/?>|\n|$)/gi;

    result = result.replace(bareUrlPattern, (match, prefix, url, suffix) => {
        const embedded = embedUrl(url.trim());
        if (embedded) {
            return (prefix || '') + embedded + (suffix || '');
        }
        return match;
    });

    // 2) autolinked URL: <p><a href="URL">URL</a></p> (marked가 자동 링크한 경우)
    const linkedUrlPattern =
        /(<p>)\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>[^<]*<\/a>\s*(<\/p>)/gi;

    result = result.replace(linkedUrlPattern, (match, pOpen, url, pClose) => {
        const embedded = embedUrl(url.trim());
        if (embedded) {
            return pOpen + embedded + pClose;
        }
        return match;
    });

    // 3) autolinked URL after <br>: <br><a href="URL">URL</a><br> 또는 끝
    const linkedBrPattern =
        /(<br\s*\/?>)\s*<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>[^<]*<\/a>\s*(?=<br|<\/p>|$)/gi;

    result = result.replace(linkedBrPattern, (match, brTag, url) => {
        const embedded = embedUrl(url.trim());
        if (embedded) {
            return brTag + embedded;
        }
        return match;
    });

    return result;
}

/**
 * URL이 임베딩 가능한지 확인
 */
export function isEmbeddable(url: string): boolean {
    return getEmbedInfo(url) !== null;
}
