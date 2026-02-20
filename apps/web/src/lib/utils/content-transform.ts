/**
 * 콘텐츠 변환 유틸리티
 * {emo:filename:size} 또는 {이모티콘:filename:size} 패턴을 <img> 태그로 변환
 * {video: URL} 또는 {동영상: URL} 패턴을 <video>/<iframe> 태그로 변환
 */

const EMOTICON_PATTERN = /\{(이모티콘|emo):([^}]*)\}/gi;
const VIDEO_PATTERN = /\{(동영상|video)\s*:\s*([\s\S]*?)\}/gi;
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

        return `<img src="/api/emoticons/nariya/${filename}" width="${width}" alt="이모티콘" loading="lazy" class="emoticon-inline">`;
    });
}

/**
 * {video: URL} / {동영상: URL} 패턴을 동영상 플레이어로 변환
 * 레거시 PHP(나리야) na_content() 호환
 */
export function transformVideos(html: string): string {
    if (!html || (!html.includes('{video') && !html.includes('{동영상'))) return html;

    return html.replace(VIDEO_PATTERN, (_match, _type: string, innerContent: string) => {
        // <a> 태그에서 URL 추출 또는 plain text URL 추출
        let url = '';
        const hrefMatch = innerContent.match(/href=["']([^"']+)["']/);
        if (hrefMatch) {
            url = hrefMatch[1].trim();
        } else {
            url = innerContent.replace(/<[^>]*>/g, '').trim();
        }

        if (!url) return '';

        // YouTube
        const ytMatch = url.match(
            /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        );
        if (ytMatch) {
            return `<div class="embed-container" data-platform="youtube" style="--aspect-ratio: 56.25%; --max-width: 100%;"><iframe src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>`;
        }

        // Vimeo
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (vimeoMatch) {
            return `<div class="embed-container" data-platform="vimeo" style="--aspect-ratio: 56.25%; --max-width: 100%;"><iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}" frameborder="0" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe></div>`;
        }

        // 직접 비디오 파일 (mp4, webm, mov 등)
        const videoExtMatch = url.match(/\.(mp4|m4v|webm|mov|f4v|flv)(\?.*)?$/i);
        if (videoExtMatch) {
            const ext = videoExtMatch[1].toLowerCase();
            const mimeType = ext === 'mov' || ext === 'm4v' || ext === 'f4v' ? 'mp4' : ext;
            return `<div class="na-video-direct"><video controls preload="metadata" playsinline style="max-width:100%;"><source src="${url}" type="video/${mimeType}">동영상을 재생할 수 없습니다.</video></div>`;
        }

        // 기타: 링크로 표시
        return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
    });
}
