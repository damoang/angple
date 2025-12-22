// API 응답 타입
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

// 페이지네이션 응답
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

// 자유게시판 게시글 타입
export interface FreePost {
    id: string;
    title: string;
    content: string;
    author: string;
    author_id: string;
    views: number;
    likes: number;
    comments_count: number;
    created_at: string;
    updated_at: string;
    tags?: string[];
    images?: string[];
}

// 자유게시판 댓글 타입
export interface FreeComment {
    id: number | string; // v2 API는 number, v1은 string
    content: string;
    author: string;
    author_id: string;
    likes?: number;
    depth?: number;
    parent_id: number | string; // v2 API는 number, v1은 string
    created_at: string;
    updated_at?: string;
    images?: string[];
}

// API 키 등록 요청/응답
export interface RegisterApiKeyRequest {
    name: string;
    email: string;
}

export interface ApiKeyResponse {
    id: string;
    name: string;
    email: string;
    token: string;
    expires_at: string;
}

// 토큰 재발급 요청
export interface RefreshTokenRequest {
    email: string;
}

// API 에러
export interface ApiError {
    success: false;
    error: string;
    code?: string;
}

// 추천 글 타입
export type RecommendedPeriod = '1h' | '3h' | '6h' | '12h' | '24h' | '48h';

export interface RecommendedPost {
    id: number;
    title: string;
    board: string;
    board_name: string;
    url: string;
    recommend_count: number;
    comment_count: number;
    view_count: number;
    author: string;
    created_at: string;
}

export interface RecommendedSection {
    id: string;
    name: string;
    group_id: string;
    count: number;
    posts: RecommendedPost[] | null;
}

export interface RecommendedData {
    generated_at: string;
    period: string;
    period_hours: number;
    sections: {
        community: RecommendedSection;
        group: RecommendedSection;
        info: RecommendedSection;
    };
}

export interface AIKeyword {
    name: string;
    strength: number;
}

export interface AIAnalysis {
    period: string;
    trend_score: number;
    trend_summary: {
        headline: string[];
        reasons: string;
    };
    ambient_whisper: string[];
    analysis_commentary: string[];
    keywords: AIKeyword[];
    analysis_scope_text: string;
    friendly_update_time: string;
}

export interface RecommendedDataWithAI extends RecommendedData {
    ai_analysis?: AIAnalysis; // Optional - Gemini API 할당량 초과 시 없을 수 있음
}

// 새로운 소식 탭 타입
export type NewsTabId = 'new' | 'tip' | 'review' | 'notice';

export interface NewsPost {
    id: number;
    title: string;
    board: string;
    board_name: string;
    author: string;
    created_at: string;
    comment_count: number;
    view_count: number;
    recommend_count: number;
    url: string;
    is_notice: boolean;
    tab: NewsTabId;
}

// 경제 탭 타입
export type EconomyTabId = 'economy' | 'qa' | 'free' | 'angtt';

export interface EconomyPost {
    id: number;
    title: string;
    url: string;
    tab: EconomyTabId;
    author?: string;
}

export interface EconomyTabsData {
    economy: EconomyPost[];
    qa: EconomyPost[];
    free: EconomyPost[];
    angtt: EconomyPost[];
}

// 갤러리 타입
export interface GalleryPost {
    id: number;
    title: string;
    url: string;
    thumbnail_url?: string;
    author: string;
    comment_count: number;
    view_count: number;
    recommend_count: number;
    created_at: string;
}

// 소모임 탭 타입
export type GroupTabId = 'all' | '24h' | 'week' | 'month';

export interface GroupPost {
    id: number;
    title: string;
    url: string;
    recommend_count: number;
    author: string;
}

export interface GroupTabsData {
    all: GroupPost[];
    '24h': GroupPost[];
    week: GroupPost[];
    month: GroupPost[];
}

// 전체 위젯 데이터
export interface IndexWidgetsData {
    news_tabs: NewsPost[];
    economy_tabs: EconomyPost[];
    gallery: GalleryPost[];
    group_tabs: GroupTabsData;
}

// 사이드바 메뉴 타입
export interface MenuItem {
    id: number;
    parent_id?: number | null;
    title: string;
    url: string;
    icon?: string;
    shortcut?: string;
    description?: string;
    depth: number;
    order_num: number;
    target: string;
    show_in_header: boolean;
    show_in_sidebar: boolean;
    children?: MenuItem[];
}

// 사용자 타입 (damoang.net SSO)
export interface DamoangUser {
    mb_id: string;
    mb_name: string;
    mb_level: number;
    mb_email: string;
}
