/**
 * 콘텐츠 변환 유틸리티
 * {emo:filename:size} 또는 {이모티콘:filename:size} 패턴을 <img> 태그로 변환
 */

const EMOTICON_PATTERN = /\{(이모티콘|emo):([^}]*)\}/gi;
const MAX_WIDTH = 200;
const DEFAULT_WIDTH = 50;
const ALLOWED_EXTENSIONS = ['.gif', '.png', '.jpg', '.jpeg', '.webp'];

/**
 * 파일명이 허용된 이미지 확장자를 가지는지 확인
 */
function isValidFilename(filename: string): boolean {
    if (!filename || filename.length > 200) return false;
    // 경로 탐색 방지
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false;
    // null byte 방지
    if (filename.includes('\0')) return false;
    // 허용된 확장자 확인
    const lower = filename.toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * 이모티콘 패턴을 <img> 태그로 변환
 */
export function transformEmoticons(text: string): string {
    if (!text || !text.includes('{')) return text;

    return text.replace(EMOTICON_PATTERN, (_match, _type: string, params: string) => {
        const parts = params.split(':');
        const filename = parts[0]?.trim();
        let width = parseInt(parts[1]?.trim() || '', 10);

        if (!filename || !isValidFilename(filename)) {
            return '😀'; // fallback 이모지
        }

        if (isNaN(width) || width <= 0) {
            width = DEFAULT_WIDTH;
        }
        if (width > MAX_WIDTH) {
            width = MAX_WIDTH;
        }

        return `<img src="/emoticons/${filename}" width="${width}" alt="이모티콘" loading="lazy" class="emoticon-inline">`;
    });
}
