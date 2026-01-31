/**
 * 위젯별 설정 타입 정의
 */

/** 게시판 위젯 설정 */
export interface BoardWidgetSettings {
    boardId?: string;
    boardIds?: string[];
    limit?: number;
    sortBy?: 'latest' | 'popular' | 'recommended';
}

/** 광고 위젯 설정 */
export interface AdWidgetSettings {
    position?: string;
    height?: string;
}

/** 사이드바 광고 위젯 설정 */
export interface SidebarAdWidgetSettings {
    type?: 'image' | 'image-text';
    format?: 'square' | 'grid';
}

/** 하드코딩 게시판 목록 (향후 API로 대체) */
export const AVAILABLE_BOARDS = [
    { id: 'free', name: '자유게시판' },
    { id: 'news', name: '뉴스' },
    { id: 'economy', name: '경제' },
    { id: 'gallery', name: '갤러리' },
    { id: 'group', name: '소모임' },
    { id: 'humor', name: '유머' },
    { id: 'tech', name: '기술' },
    { id: 'qna', name: '질문답변' }
] as const;

/** 위젯 설정이 게시판 필터를 지원하는 타입 */
export const BOARD_FILTERABLE_WIDGET_TYPES = [
    'new-board',
    'economy',
    'news-economy-row',
    'gallery',
    'group'
] as const;
