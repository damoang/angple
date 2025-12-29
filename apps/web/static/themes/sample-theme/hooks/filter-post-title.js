/**
 * 게시물 제목 필터링 Filter Hook
 */
export default function filterPostTitle(title) {
    console.log('🎨 Sample Theme: 제목 필터링 중...', title);
    return `✨ ${title} ✨`;
}
