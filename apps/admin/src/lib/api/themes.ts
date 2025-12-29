/**
 * Web 앱의 테마 API 클라이언트
 *
 * Admin에서 Web의 테마 설정을 원격 제어합니다.
 */

import type { ThemeWithStatus } from '$lib/types';

// Web 앱 API 기본 URL (환경변수로 설정 가능)
const WEB_API_BASE_URL = import.meta.env.VITE_WEB_API_URL || 'http://localhost:5173';

/**
 * 설치된 모든 테마 목록 조회
 */
export async function getThemes(): Promise<ThemeWithStatus[]> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/themes`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.themes;
    } catch (error) {
        console.error('❌ 테마 목록 조회 실패:', error);
        throw error;
    }
}

/**
 * 현재 활성화된 테마 ID 조회
 */
export async function getActiveTheme(): Promise<string | null> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/themes/active`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.activeTheme;
    } catch (error) {
        console.error('❌ 활성 테마 조회 실패:', error);
        throw error;
    }
}

/**
 * 테마 활성화 (Web 앱에 반영)
 */
export async function setActiveTheme(themeId: string): Promise<void> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/themes/active`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ themeId })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        console.log('✅ 테마 활성화 성공:', { themeId });
    } catch (error) {
        console.error('❌ 테마 활성화 실패:', { error });
        throw error;
    }
}

/**
 * 특정 테마의 설정 조회
 */
export async function getThemeSettings(themeId: string): Promise<Record<string, unknown>> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/themes/${themeId}/settings`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.settings;
    } catch (error) {
        console.error('❌ 테마 설정 조회 실패:', { themeId, error });
        throw error;
    }
}

/**
 * 특정 테마의 설정 저장
 */
export async function setThemeSettings(
    themeId: string,
    settings: Record<string, unknown>
): Promise<void> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/themes/${themeId}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        console.log('✅ 테마 설정 저장 성공:', { themeId });
    } catch (error) {
        console.error('❌ 테마 설정 저장 실패:', { themeId, error });
        throw error;
    }
}
