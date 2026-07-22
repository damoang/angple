/**
 * 본문에서 blob: URL 미디어를 제거한다 (bug/12981).
 *
 * blob: 은 세션 한정 URL — localStorage draft 에 그대로 저장되면 복원 시 절대 로드될 수
 * 없는 죽은 이미지가 부활하고, 제출 가드(blob 잔존 차단)에 영구히 막힌다.
 * 저장 직전과 복원 직후 양쪽에서 걷어내 이미 오염된 기존 draft 도 구제한다.
 */
export function stripBlobMedia(content: string): string {
    if (!content || !content.includes('blob:')) return content;
    return (
        content
            // HTML: src 가 blob: 인 img/video/source 태그 제거 (닫는 태그가 바로 붙으면 함께)
            .replace(
                /<(img|video|source)\b[^>]*\bsrc=["']blob:[^"']*["'][^>]*\/?>(?:<\/\1>)?/gi,
                ''
            )
            // Markdown: ![alt](blob:...) 제거
            .replace(/!\[[^\]]*\]\(blob:[^)]*\)/g, '')
    );
}
