/**
 * Web 앱의 플러그인 API 클라이언트
 *
 * Admin에서 Web의 플러그인 설정을 원격 제어합니다.
 * 테마 API(themes.ts)와 동일한 패턴으로 구현되었습니다.
 */

import type { PluginWithStatus } from '$lib/types';

// Web 앱 API 기본 URL (환경변수로 설정 가능)
const WEB_API_BASE_URL = import.meta.env.VITE_WEB_API_URL || 'http://localhost:5173';

/**
 * 설치된 모든 플러그인 목록 조회
 */
export async function getPlugins(): Promise<PluginWithStatus[]> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/plugins`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.plugins;
    } catch (error) {
        console.error('❌ 플러그인 목록 조회 실패:', error);
        throw error;
    }
}

/**
 * 활성화된 플러그인 목록 조회
 */
export async function getActivePlugins(): Promise<string[]> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/plugins/active`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data.plugins.map((p: { id: string }) => p.id);
    } catch (error) {
        console.error('❌ 활성 플러그인 조회 실패:', error);
        throw error;
    }
}

/**
 * 플러그인 활성화
 */
export async function activatePlugin(pluginId: string): Promise<void> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/plugins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pluginId, action: 'activate' })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        console.log('✅ 플러그인 활성화 성공:', { pluginId });
    } catch (error) {
        console.error('❌ 플러그인 활성화 실패:', { pluginId, error });
        throw error;
    }
}

/**
 * 플러그인 비활성화
 */
export async function deactivatePlugin(pluginId: string): Promise<void> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/plugins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pluginId, action: 'deactivate' })
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        console.log('✅ 플러그인 비활성화 성공:', { pluginId });
    } catch (error) {
        console.error('❌ 플러그인 비활성화 실패:', { pluginId, error });
        throw error;
    }
}

/**
 * 플러그인 삭제 (커스텀 플러그인만 가능)
 */
export async function deletePlugin(pluginId: string): Promise<void> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/plugins/${pluginId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        console.log('✅ 플러그인 삭제 성공:', { pluginId });
    } catch (error) {
        console.error('❌ 플러그인 삭제 실패:', { pluginId, error });
        throw error;
    }
}

/**
 * 특정 플러그인의 설정 조회
 */
export async function getPluginSettings(
    pluginId: string
): Promise<{ settings: Record<string, unknown>; schema: Record<string, unknown> }> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/plugins/${pluginId}/settings`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return { settings: data.settings, schema: data.schema };
    } catch (error) {
        console.error('❌ 플러그인 설정 조회 실패:', { pluginId, error });
        throw error;
    }
}

/**
 * 특정 플러그인의 설정 저장
 */
export async function setPluginSettings(
    pluginId: string,
    settings: Record<string, unknown>
): Promise<void> {
    try {
        const response = await fetch(`${WEB_API_BASE_URL}/api/plugins/${pluginId}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        console.log('✅ 플러그인 설정 저장 성공:', { pluginId });
    } catch (error) {
        console.error('❌ 플러그인 설정 저장 실패:', { pluginId, error });
        throw error;
    }
}
