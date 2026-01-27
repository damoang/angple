/**
 * 위젯 관련 타입 정의
 */

export interface WidgetConfig {
    id: string;
    type: string;
    position: number;
    enabled: boolean;
    settings?: Record<string, unknown>;
}

export interface WidgetRegistryEntry {
    name: string;
    icon: string;
    description: string;
    category: 'content' | 'ad' | 'layout' | 'sidebar';
    allowMultiple: boolean;
    defaultSettings?: Record<string, unknown>;
    sidebarOnly?: boolean;
}

/**
 * 위젯 레지스트리 (Web 앱과 동일한 정의)
 */
export const WIDGET_REGISTRY: Record<string, WidgetRegistryEntry> = {
    recommended: {
        name: '추천 글',
        icon: 'Star',
        description: '인기 있는 추천 게시글 목록',
        category: 'content',
        allowMultiple: false
    },
    'new-board': {
        name: '새로운 소식',
        icon: 'Newspaper',
        description: '최신 소식 게시판',
        category: 'content',
        allowMultiple: false
    },
    economy: {
        name: '알뜰구매',
        icon: 'ShoppingCart',
        description: '알뜰 구매 정보',
        category: 'content',
        allowMultiple: false
    },
    'news-economy-row': {
        name: '새소식 + 알뜰구매',
        icon: 'LayoutGrid',
        description: '새소식과 알뜰구매를 2열로 표시',
        category: 'layout',
        allowMultiple: false
    },
    gallery: {
        name: '갤러리',
        icon: 'Images',
        description: '이미지 갤러리 그리드',
        category: 'content',
        allowMultiple: false
    },
    group: {
        name: '소모임',
        icon: 'Users',
        description: '소모임 추천글',
        category: 'content',
        allowMultiple: false
    },
    ad: {
        name: '광고',
        icon: 'Megaphone',
        description: '광고 슬롯',
        category: 'ad',
        allowMultiple: true,
        defaultSettings: {
            position: 'index-custom',
            height: '90px'
        }
    },

    // 사이드바 위젯
    notice: {
        name: '공지사항',
        icon: 'Info',
        description: '공지사항 목록',
        category: 'sidebar',
        allowMultiple: false,
        sidebarOnly: true
    },
    podcast: {
        name: '팟캐스트',
        icon: 'Play',
        description: '다모앙 팟캐스트 플레이어',
        category: 'sidebar',
        allowMultiple: false,
        sidebarOnly: true
    },
    'sidebar-ad': {
        name: '사이드바 광고',
        icon: 'Image',
        description: '사이드바 광고 배너',
        category: 'sidebar',
        allowMultiple: true,
        sidebarOnly: true,
        defaultSettings: {
            type: 'image',
            format: 'square'
        }
    },
    'sharing-board': {
        name: '나눔 게시판',
        icon: 'Gift',
        description: '나눔 게시판 위젯',
        category: 'sidebar',
        allowMultiple: false,
        sidebarOnly: true
    },
    'sticky-ads': {
        name: '스티키 광고',
        icon: 'Pin',
        description: '화면에 고정되는 광고',
        category: 'sidebar',
        allowMultiple: false,
        sidebarOnly: true
    }
};

/**
 * 위젯 타입별 아이콘 이름 가져오기
 */
export function getWidgetIcon(type: string): string {
    return WIDGET_REGISTRY[type]?.icon ?? 'Box';
}

/**
 * 위젯 타입별 표시 이름 가져오기
 */
export function getWidgetName(type: string): string {
    return WIDGET_REGISTRY[type]?.name ?? type;
}

/**
 * 카테고리별 위젯 목록 가져오기
 */
export function getWidgetsByCategory(category: WidgetRegistryEntry['category']): string[] {
    return Object.entries(WIDGET_REGISTRY)
        .filter(([, entry]) => entry.category === category)
        .map(([type]) => type);
}

/**
 * 추가 가능한 위젯 목록 가져오기 (현재 레이아웃 고려)
 */
export function getAddableWidgets(currentWidgetTypes: string[], forSidebar: boolean = false): string[] {
    return Object.entries(WIDGET_REGISTRY)
        .filter(([type, entry]) => {
            // 사이드바 필터링
            if (forSidebar && !entry.sidebarOnly) return false;
            if (!forSidebar && entry.sidebarOnly) return false;

            if (entry.allowMultiple) return true;
            return !currentWidgetTypes.includes(type);
        })
        .map(([type]) => type);
}

/**
 * 사이드바 위젯인지 확인
 */
export function isSidebarWidget(type: string): boolean {
    return WIDGET_REGISTRY[type]?.sidebarOnly ?? false;
}

/**
 * 메인 영역 위젯 목록 가져오기
 */
export function getMainWidgetTypes(): string[] {
    return Object.entries(WIDGET_REGISTRY)
        .filter(([, entry]) => !entry.sidebarOnly)
        .map(([type]) => type);
}

/**
 * 사이드바 위젯 목록 가져오기
 */
export function getSidebarWidgetTypes(): string[] {
    return Object.entries(WIDGET_REGISTRY)
        .filter(([, entry]) => entry.sidebarOnly)
        .map(([type]) => type);
}

export type WidgetZone = 'main' | 'sidebar';
