/**
 * 설정 저장소 Provider 인터페이스
 *
 * JSON, MySQL, SQLite 등 다양한 저장소를 추상화
 * Provider Pattern을 통해 저장소 변경 시 코드 수정 최소화
 */

import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';

export interface SettingsProvider {
    /**
     * 현재 활성화된 테마 ID 조회
     * @returns 테마 ID 또는 null (활성화된 테마 없음)
     */
    getActiveTheme(): Promise<string | null>;

    /**
     * 테마 활성화
     * @param themeId - 활성화할 테마 ID
     */
    setActiveTheme(themeId: string): Promise<void>;

    /**
     * 특정 테마의 설정값 조회
     * @param themeId - 테마 ID
     * @returns 테마 설정 객체
     */
    getThemeSettings(themeId: string): Promise<Record<string, unknown>>;

    /**
     * 특정 테마의 설정값 저장
     * @param themeId - 테마 ID
     * @param settings - 저장할 설정값
     */
    setThemeSettings(themeId: string, settings: Record<string, unknown>): Promise<void>;

    /**
     * 전체 설정 조회 (디버깅/백업용)
     */
    getAllSettings(): Promise<Record<string, unknown>>;

    // ========== 위젯 레이아웃 관련 ==========

    /**
     * 메인 영역 위젯 레이아웃 조회
     */
    getWidgetLayout(): Promise<WidgetConfig[] | null>;

    /**
     * 메인 영역 위젯 레이아웃 저장
     */
    setWidgetLayout(widgets: WidgetConfig[]): Promise<void>;

    /**
     * 사이드바 위젯 레이아웃 조회
     */
    getSidebarWidgetLayout(): Promise<WidgetConfig[] | null>;

    /**
     * 사이드바 위젯 레이아웃 저장
     */
    setSidebarWidgetLayout(widgets: WidgetConfig[]): Promise<void>;
}
