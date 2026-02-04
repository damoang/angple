/**
 * 이모티콘 파서 유틸리티
 * {emo:filename:width} 형식을 <img> 태그로 변환
 */

import type { EmoticonParseResult } from './types';

const EMO_PATTERN = /\{emo:([^}]+)\}/g;
const ALLOWED_EXTENSIONS = ['.gif', '.png', '.jpg', '.jpeg', '.webp'];
const DEFAULT_WIDTH = 50;
const MAX_WIDTH = 200;

/**
 * 이모티콘 코드 파싱
 */
export function parseEmoticonCode(code: string): EmoticonParseResult | null {
    const parts = code.split(':');
    const filename = parts[0];

    if (!filename || !isAllowedExtension(filename)) {
        return null;
    }

    // path traversal 차단
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return null;
    }

    let width = DEFAULT_WIDTH;
    if (parts.length > 1) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed) && parsed > 0) {
            width = Math.min(Math.max(parsed, 20), MAX_WIDTH);
        }
    }

    return { filename, width };
}

/**
 * 콘텐츠 내 {emo:...} 코드를 <img> 태그로 변환
 */
export function replaceEmoticons(content: string, baseUrl: string): string {
    return content.replace(EMO_PATTERN, (_match, code: string) => {
        const result = parseEmoticonCode(code);
        if (!result) {
            return renderFallback(baseUrl);
        }

        const src = escapeHtml(`${baseUrl}/image/${result.filename}`);
        return `<img src="${src}" width="${result.width}" class="emoticon" loading="lazy" alt="emoticon" />`;
    });
}

/**
 * 삭제된 이모티콘 폴백 렌더링
 */
function renderFallback(baseUrl: string): string {
    const src = escapeHtml(`${baseUrl}/image/damoang-emo-010.gif`);
    return `(삭제된 이모지) <img src="${src}" width="${DEFAULT_WIDTH}" class="emoticon" loading="lazy" alt="deleted emoticon" />`;
}

/**
 * 허용 확장자 확인
 */
function isAllowedExtension(filename: string): boolean {
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * HTML 특수문자 이스케이프
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
