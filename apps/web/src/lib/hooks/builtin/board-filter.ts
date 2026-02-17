/**
 * 게시판 필터 Built-in Hook
 * 차단 회원 필터링, 신고 글 표시 등 기본 게시판 기능
 */
import { hooks } from '@angple/hook-system';

// 로컬 타입 정의 (hook 컨텍스트용)
interface Post {
    id: string | number;
    authorId: string | number;
    isReported?: boolean;
    [key: string]: unknown;
}

interface FilterContext {
    user?: {
        blockedUsers?: (string | number)[];
        reportedPosts?: (string | number)[];
    };
}

/**
 * 게시판 필터 초기화
 * 앱 시작 시 자동으로 등록되는 필수 필터들
 */
export function initBoardFilters(): void {
    // 차단 회원 필터 (priority: 10)
    hooks.addFilter('post_list', filterBlockedUsers, 10);

    // 신고된 글 마킹 (priority: 20)
    hooks.addFilter('post_list', markReportedPosts, 20);
}

/**
 * 차단된 회원의 글 필터링
 * 사용자가 차단한 회원의 글을 목록에서 제외
 */
function filterBlockedUsers(posts: Post[], context: FilterContext): Post[] {
    const blockedUsers = context?.user?.blockedUsers || [];

    if (blockedUsers.length === 0) {
        return posts;
    }

    return posts.filter((post) => !blockedUsers.includes(post.authorId));
}

/**
 * 신고된 글 표시
 * 사용자가 신고한 글에 isReported 플래그 추가
 */
function markReportedPosts(posts: Post[], context: FilterContext): Post[] {
    const reportedPosts = context?.user?.reportedPosts || [];

    if (reportedPosts.length === 0) {
        return posts;
    }

    return posts.map((post) => ({
        ...post,
        isReported: reportedPosts.includes(post.id)
    }));
}
