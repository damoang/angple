/**
 * 게시판 표시 설정 API 클라이언트
 *
 * v2_board_display_settings 테이블을 통해
 * 게시판별 목록/본문 레이아웃 설정을 관리합니다.
 */

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:8081';

interface APIResponse<T> {
    data: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
}

export interface BoardDisplaySettings {
    list_layout: string;
    view_layout: string;
    list_style?: string;
    show_preview: boolean;
    preview_length: number;
    show_thumbnail: boolean;
}

export interface UpdateDisplaySettingsRequest {
    list_layout?: string;
    view_layout?: string;
    show_preview?: boolean;
    preview_length?: number;
    show_thumbnail?: boolean;
}

/**
 * 게시판 표시 설정 조회
 */
export async function getDisplaySettings(boardId: string): Promise<BoardDisplaySettings> {
    const response = await fetch(`${BACKEND_API_URL}/api/v1/boards/${boardId}/display-settings`, {
        credentials: 'include'
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const result: APIResponse<BoardDisplaySettings> = await response.json();
    return result.data;
}

/**
 * 게시판 표시 설정 수정 (관리자 전용)
 */
export async function updateDisplaySettings(
    boardId: string,
    settings: UpdateDisplaySettingsRequest
): Promise<BoardDisplaySettings> {
    const response = await fetch(`${BACKEND_API_URL}/api/v1/boards/${boardId}/display-settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });

    if (!response.ok) {
        const errorResult = await response.json().catch(() => null);
        throw new Error(errorResult?.error?.message || `HTTP ${response.status}`);
    }

    const result: APIResponse<BoardDisplaySettings> = await response.json();
    return result.data;
}
