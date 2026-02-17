/**
 * 대괄호 이미지 변환 플러그인
 *
 * [https://example.com/data/editor/2602/image.jpeg] 형태를
 * <img> 태그로 변환합니다.
 *
 * 보안:
 * - 허용된 도메인만 이미지로 변환
 * - 이미지 확장자만 허용
 * - XSS 방지를 위한 URL 검증
 */

import type { EmbedPlatform, EmbedInfo } from '../types.js';

/** S3 URL에서 호스트네임 추출 */
function extractHostname(url: string): string | null {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

/** 허용된 이미지 도메인 목록 (환경변수 기반 + 고정 목록) */
const ALLOWED_DOMAINS = [
    ...(extractHostname(import.meta.env.VITE_S3_URL || '')
        ? [extractHostname(import.meta.env.VITE_S3_URL || '')!]
        : []),
    ...(extractHostname(import.meta.env.VITE_LEGACY_URL || '')
        ? [extractHostname(import.meta.env.VITE_LEGACY_URL || '')!]
        : []),
    'i.imgur.com',
    'imgur.com'
];

/** 허용된 이미지 확장자 */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

/**
 * URL이 허용된 도메인인지 확인
 */
function isAllowedDomain(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return ALLOWED_DOMAINS.some(
            (domain) => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * URL이 이미지 확장자를 가지는지 확인
 */
function hasImageExtension(url: string): boolean {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        return IMAGE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    } catch {
        return false;
    }
}

/**
 * URL 검증 (XSS 방지)
 */
function isValidImageUrl(url: string): boolean {
    // 기본 URL 형식 확인
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        return false;
    }

    // javascript: 프로토콜 등 차단
    if (url.includes('javascript:') || url.includes('data:')) {
        return false;
    }

    // 도메인 및 확장자 확인
    return isAllowedDomain(url) && hasImageExtension(url);
}

/**
 * 파일명에서 alt 텍스트 추출
 */
function extractAltText(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop() || '';
        // 확장자 제거
        return filename.replace(/\.[^.]+$/, '') || '이미지';
    } catch {
        return '이미지';
    }
}

export const bracketImage: EmbedPlatform = {
    name: 'bracket-image',

    // 대괄호로 감싸진 URL 패턴
    patterns: [/\[https?:\/\/[^\]\s]+\]/i],

    extract(url: string): EmbedInfo | null {
        // 대괄호 제거
        const cleanUrl = url.replace(/^\[|\]$/g, '');

        if (!isValidImageUrl(cleanUrl)) {
            return null;
        }

        return {
            platform: 'bracket-image',
            id: cleanUrl,
            url: cleanUrl
        };
    },

    render(info: EmbedInfo): string {
        const alt = extractAltText(info.url);
        // 이미지 태그 렌더링 (lazy loading, 최대 너비 제한)
        return `<img src="${info.url}" alt="${alt}" class="bracket-image" loading="lazy" />`;
    }
};

/**
 * 대괄호 이미지 패턴 처리
 * [https://...image.jpg] → <img src="..." />
 */
export function processBracketImages(content: string): string {
    // 대괄호로 감싸진 URL 패턴
    const pattern = /\[(https?:\/\/[^\]\s]+)\]/gi;

    return content.replace(pattern, (match, url) => {
        if (!isValidImageUrl(url)) {
            // 유효하지 않은 URL은 원본 유지
            return match;
        }

        const alt = extractAltText(url);
        return `<img src="${url}" alt="${alt}" class="bracket-image" loading="lazy" />`;
    });
}

/**
 * 허용 도메인 목록 조회
 */
export function getAllowedDomains(): string[] {
    return [...ALLOWED_DOMAINS];
}

/**
 * 허용 확장자 목록 조회
 */
export function getAllowedExtensions(): string[] {
    return [...IMAGE_EXTENSIONS];
}
