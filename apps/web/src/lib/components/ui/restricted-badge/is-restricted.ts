/**
 * 이용제한 글/댓글 식별 — wr_subject 또는 wr_content 가 `[신고잠김]` prefix 로 시작.
 * damoang-backend UnlockPostContent 가 잠금 시 prefix 추가, 해제 시 prefix 제거.
 */
export function isRestrictedTitle(title: string | undefined | null): boolean {
    return typeof title === 'string' && title.startsWith('[신고잠김]');
}
