/**
 * Filter Hook: post_title
 *
 * 게시물 제목을 필터링/변환합니다.
 * 예시: 특정 조건에서 이모지 추가, 텍스트 변환 등
 */

export default async function filterPostTitle(title, post) {
    console.log('🔄 [Sample Theme Hook] Filtering post title:', title);

    // 예시 1: 조회수가 1000 이상이면 인기 표시
    if (post && post.viewCount && post.viewCount >= 1000) {
        return `🔥 ${title}`;
    }

    // 예시 2: 댓글이 50개 이상이면 Hot 표시
    if (post && post.commentCount && post.commentCount >= 50) {
        return `💬 ${title}`;
    }

    // 예시 3: 최신 게시물 (24시간 이내)이면 NEW 표시
    if (post && post.createdAt) {
        const now = new Date();
        const postDate = new Date(post.createdAt);
        const hoursDiff = (now - postDate) / (1000 * 60 * 60);

        if (hoursDiff <= 24) {
            return `✨ ${title}`;
        }
    }

    // 변경하지 않으면 원본 반환
    return title;
}
