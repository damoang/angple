/**
 * Web 앱의 위젯 레이아웃 API 클라이언트
 *
 * Admin에서 Web의 위젯 설정을 원격 제어합니다.
 */

// Web 앱 API 기본 URL (환경변수로 설정 가능)
const WEB_API_BASE_URL = import.meta.env.VITE_WEB_API_URL || 'http://localhost:5173';

export interface WidgetConfig {
    id: string;
    type: string;
    position: number;
    enabled: boolean;
    settings?: Record<string, unknown>;
}

export interface WidgetLayoutResponse {
    widgets: WidgetConfig[];
    sidebarWidgets: WidgetConfig[];
}

/**
 * 위젯 레이아웃 조회
 */
export async function getWidgetLayout(): Promise<WidgetLayoutResponse> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/layout`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('❌ 위젯 레이아웃 조회 실패:', error);
        throw error;
    }
}

/**
 * 위젯 레이아웃 저장
 */
export async function saveWidgetLayout(
    widgets: WidgetConfig[],
    sidebarWidgets: WidgetConfig[]
): Promise<void> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/layout`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ widgets, sidebarWidgets })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        console.log('✅ 위젯 레이아웃 저장 성공');
    } catch (error) {
        console.error('❌ 위젯 레이아웃 저장 실패:', error);
        throw error;
    }
}
