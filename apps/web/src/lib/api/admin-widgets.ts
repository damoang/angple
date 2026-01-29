/**
 * 위젯 레이아웃 API 클라이언트
 */

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

export async function getWidgetLayout(): Promise<WidgetLayoutResponse> {
    try {
        const response = await fetch('/api/layout');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('❌ 위젯 레이아웃 조회 실패:', error);
        throw error;
    }
}

export async function saveWidgetLayout(
    widgets: WidgetConfig[],
    sidebarWidgets: WidgetConfig[]
): Promise<void> {
    try {
        const response = await fetch('/api/layout', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ widgets, sidebarWidgets })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 위젯 레이아웃 저장 실패:', error);
        throw error;
    }
}
