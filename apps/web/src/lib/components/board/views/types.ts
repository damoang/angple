/**
 * 게시판 뷰 공통 타입
 */

/** 게시물 요약 정보 (뷰 렌더링용) */
export interface PostSummary {
    id: string | number;
    title: string;
    author: string;
    authorAvatar?: string;
    createdAt: string;
    viewCount: number;
    commentCount: number;
    likeCount: number;
    thumbnail?: string;
    excerpt?: string;
    tags?: string[];
    isPinned?: boolean;
    isNew?: boolean;
    boardId?: string;
    boardName?: string;
}

/** 뷰 컴포넌트 공통 Props */
export interface BoardViewProps {
    posts: PostSummary[];
    boardId: string;
    isLoading?: boolean;
}
