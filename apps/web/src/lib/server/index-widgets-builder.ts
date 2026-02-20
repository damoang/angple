/**
 * 개별 게시판 API를 병렬 호출하여 IndexWidgetsData를 조립하는 서버 전용 유틸리티
 *
 * 백엔드 /api/v1/recommended/index-widgets 엔드포인트가 deprecated 되어
 * 빈 배열을 반환하므로, 개별 게시판 API를 직접 호출하여 데이터를 구성합니다.
 */

import type {
    IndexWidgetsData,
    NewsPost,
    NewsTabId,
    EconomyPost,
    EconomyTabId,
    GalleryPost,
    GroupTabsData
} from '$lib/api/types';

/** 백엔드 게시글 응답 타입 */
interface BackendPost {
    id: number;
    title: string;
    author: string;
    author_id: string;
    created_at: string;
    views: number;
    likes: number;
    dislikes?: number;
    comments_count: number;
    has_file?: boolean;
    thumbnail?: string;
    category?: string;
    content?: string;
}

interface BackendBoardResponse {
    data: BackendPost[];
    meta: {
        board_id: string;
        page: number;
        limit: number;
        total: number;
    };
}

/** 백엔드 게시글 → NewsPost 변환 */
function toNewsPost(post: BackendPost, tab: NewsTabId): NewsPost {
    return {
        id: post.id,
        title: post.title,
        board: tab,
        board_name: getBoardName(tab),
        author: post.author,
        created_at: post.created_at,
        comment_count: post.comments_count,
        view_count: post.views,
        recommend_count: post.likes,
        url: `/${tab}/${post.id}`,
        is_notice: false,
        tab
    };
}

/** 백엔드 게시글 → EconomyPost 변환 */
function toEconomyPost(post: BackendPost, tab: EconomyTabId): EconomyPost {
    return {
        id: post.id,
        title: post.title,
        url: `/${tab}/${post.id}`,
        tab,
        author: post.author
    };
}

/** 백엔드 게시글 → GalleryPost 변환 */
function toGalleryPost(post: BackendPost): GalleryPost {
    return {
        id: post.id,
        title: post.title,
        url: `/gallery/${post.id}`,
        thumbnail_url: post.thumbnail,
        author: post.author,
        comment_count: post.comments_count,
        view_count: post.views,
        recommend_count: post.likes,
        created_at: post.created_at
    };
}

/** 게시판 ID → 한글 이름 매핑 */
function getBoardName(boardId: string): string {
    const names: Record<string, string> = {
        notice: '공지사항',
        new: '새글',
        tip: '팁과정보',
        review: '사용기',
        economy: '알뜰구매',
        qa: '질문답변',
        free: '자유게시판',
        angtt: '앙뜨',
        gallery: '갤러리'
    };
    return names[boardId] ?? boardId;
}

/** 개별 게시판 API 호출 */
async function fetchBoardPosts(
    backendUrl: string,
    boardId: string,
    limit: number
): Promise<BackendPost[]> {
    const response = await fetch(
        `${backendUrl}/api/v1/boards/${boardId}/posts?limit=${limit}&page=1`,
        {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Angple-Web-SSR/1.0'
            }
        }
    );

    if (!response.ok) {
        console.error(`[index-widgets-builder] ${boardId} API error:`, response.status);
        return [];
    }

    const result: BackendBoardResponse = await response.json();
    return result.data ?? [];
}

/**
 * 개별 게시판 API를 병렬 호출하여 IndexWidgetsData를 조립
 */
export async function buildIndexWidgets(backendUrl: string): Promise<IndexWidgetsData> {
    // news_tabs 게시판: notice, new, review
    // economy_tabs 게시판: economy, qa, free, angtt
    // gallery 게시판: gallery
    const [
        noticePosts,
        newPosts,
        reviewPosts,
        economyPosts,
        qaPosts,
        freePosts,
        angttPosts,
        galleryPosts
    ] = await Promise.allSettled([
        fetchBoardPosts(backendUrl, 'notice', 15),
        fetchBoardPosts(backendUrl, 'new', 15),
        fetchBoardPosts(backendUrl, 'review', 15),
        fetchBoardPosts(backendUrl, 'economy', 10),
        fetchBoardPosts(backendUrl, 'qa', 10),
        fetchBoardPosts(backendUrl, 'free', 10),
        fetchBoardPosts(backendUrl, 'angtt', 10),
        fetchBoardPosts(backendUrl, 'gallery', 12)
    ]);

    const resolve = (result: PromiseSettledResult<BackendPost[]>): BackendPost[] =>
        result.status === 'fulfilled' ? result.value : [];

    // news_tabs: notice + new + review 게시글을 NewsPost[]로 변환
    const newsTabs: NewsPost[] = [
        ...resolve(noticePosts).map((p) => toNewsPost(p, 'notice')),
        ...resolve(newPosts).map((p) => toNewsPost(p, 'new')),
        ...resolve(reviewPosts).map((p) => toNewsPost(p, 'review'))
    ];

    // economy_tabs: economy + qa + free + angtt 게시글을 EconomyPost[]로 변환
    const economyTabs: EconomyPost[] = [
        ...resolve(economyPosts).map((p) => toEconomyPost(p, 'economy')),
        ...resolve(qaPosts).map((p) => toEconomyPost(p, 'qa')),
        ...resolve(freePosts).map((p) => toEconomyPost(p, 'free')),
        ...resolve(angttPosts).map((p) => toEconomyPost(p, 'angtt'))
    ];

    // gallery: gallery 게시글을 GalleryPost[]로 변환
    const gallery: GalleryPost[] = resolve(galleryPosts).map(toGalleryPost);

    // group_tabs: 소모임 게시판 (현재 빈 데이터)
    const groupTabs: GroupTabsData = {
        all: [],
        '24h': [],
        week: [],
        month: []
    };

    return {
        news_tabs: newsTabs,
        economy_tabs: economyTabs,
        gallery,
        group_tabs: groupTabs
    };
}

/**
 * 단일 게시판 데이터 조회 (post-list 위젯용)
 */
export async function fetchBoardPostsForWidget(
    backendUrl: string,
    boardId: string,
    limit: number
): Promise<BackendPost[]> {
    return fetchBoardPosts(backendUrl, boardId, limit);
}
