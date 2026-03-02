/**
 * 게시판 확장 설정 API 클라이언트
 *
 * v2_board_extended_settings 테이블을 통해
 * 게시판별 확장 설정(댓글, 럭키포인트, 기능, 프로모션 등)을 관리합니다.
 */

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

/** 댓글 설정 */
export interface CommentSettings {
    imageSizeLimit?: boolean;
    imageSizeLimitMB?: number;
    autoEmbed?: boolean;
    useRecommend?: boolean;
    useDislike?: boolean;
    authorOnly?: boolean;
    paging?: 'oldest' | 'newest';
    pageSize?: number;
}

/** 럭키 포인트 설정 */
export interface LuckySettings {
    points?: number;
    odds?: number;
}

/** XP(경험치) 설정 */
export interface XPSettings {
    write?: number;
    comment?: number;
}

/** 기능 토글 설정 */
export interface FeatureSettings {
    autoEmbed?: boolean;
    attachmentVideoAutoPlay?: boolean;
    linkVideoAutoPlay?: boolean;
    videoAutoStart?: boolean;
    codeHighlighter?: boolean;
    externalImageSave?: boolean;
    hideNickname?: boolean;
    rating?: boolean;
    categoryMove?: boolean;
    tags?: boolean;
    tagLevel?: number;
    mobileEditor?: string;
    categoryMovePermit?: string;
    categoryMoveMessage?: string;
}

/** 스킨 설정 */
export interface SkinSettings {
    category?: string;
    list?: string;
    view?: string;
    comment?: string;
}

/** 알림 설정 */
export interface NotificationSettings {
    newPostReceivers?: string;
    enabled?: boolean;
}

/** 글쓰기 제한 설정 */
export interface WritingSettings {
    maxPosts?: number;
    allowedLevels?: string;
    restrictedUsers?: boolean;
    memberOnly?: boolean;
    memberOnlyPermit?: string;
    allowedMembersOne?: string;
    allowedMembersTwo?: string;
    allowedMembersThree?: string;
}

/** 프로모션 오버라이드 설정 */
export interface PromotionSettings {
    insertIndex?: number | null;
    insertCount?: number | null;
    minPostCount?: number | null;
}

/** 전체 확장 설정 JSON 구조 */
export interface ExtendedSettings {
    comment?: CommentSettings;
    lucky?: LuckySettings;
    xp?: XPSettings;
    features?: FeatureSettings;
    notification?: NotificationSettings;
    writing?: WritingSettings;
    skin?: SkinSettings;
    promotion?: PromotionSettings;
}

/** API 응답 형태 */
export interface ExtendedSettingsResponse {
    board_id: string;
    settings: string; // JSON string
}

/**
 * 게시판 확장 설정 조회
 */
export async function getExtendedSettings(boardId: string): Promise<ExtendedSettings> {
    const response = await fetch(`/api/v1/boards/${boardId}/extended-settings`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const result: APIResponse<ExtendedSettingsResponse> = await response.json();
    try {
        return JSON.parse(result.data.settings || '{}');
    } catch {
        return {};
    }
}

/**
 * 게시판 확장 설정 수정 (관리자 전용)
 */
export async function updateExtendedSettings(
    boardId: string,
    settings: ExtendedSettings
): Promise<ExtendedSettings> {
    const response = await fetch(`/api/v1/boards/${boardId}/extended-settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: JSON.stringify(settings) })
    });

    if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.error?.message || `HTTP ${response.status}`);
    }

    const result: APIResponse<ExtendedSettingsResponse> = await response.json();
    try {
        return JSON.parse(result.data.settings || '{}');
    } catch {
        return {};
    }
}
