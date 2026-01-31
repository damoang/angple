/**
 * 썸네일 생성 유틸리티
 *
 * HTML 콘텐츠에서 첫 번째 이미지를 추출하여 썸네일로 사용합니다.
 */

/** HTML 콘텐츠에서 첫 번째 이미지 URL 추출 */
export function extractFirstImage(html: string): string | null {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match?.[1] || null;
}

/** 이미지 URL에서 썸네일 URL 생성 (리사이즈) */
export function getThumbnailUrl(imageUrl: string, width = 300, height = 200): string {
    // 이미지 최적화 API 사용
    return `/api/image?url=${encodeURIComponent(imageUrl)}&w=${width}&f=webp`;
}

/** 게시글에서 썸네일 URL 결정 */
export function resolvePostThumbnail(post: {
    thumbnail?: string;
    images?: string[];
    content?: string;
}): string | null {
    // 1. 명시적 썸네일 필드
    if (post.thumbnail) return post.thumbnail;

    // 2. 첨부 이미지
    if (post.images && post.images.length > 0) {
        return getThumbnailUrl(post.images[0]);
    }

    // 3. 본문에서 이미지 추출
    if (post.content) {
        const imgUrl = extractFirstImage(post.content);
        if (imgUrl) return getThumbnailUrl(imgUrl);
    }

    return null;
}
