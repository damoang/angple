/**
 * 플러그인 API 클라이언트
 */

import type { PluginWithStatus } from '$lib/types/admin-plugin';

export async function getPlugins(): Promise<PluginWithStatus[]> {
    try {
        const response = await fetch('/api/plugins');
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

export async function getActivePlugins(): Promise<string[]> {
    try {
        const response = await fetch('/api/plugins/active');
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

export async function activatePlugin(pluginId: string): Promise<void> {
    try {
        const response = await fetch('/api/plugins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pluginId, action: 'activate' })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 플러그인 활성화 실패:', { pluginId, error });
        throw error;
    }
}

export async function deactivatePlugin(pluginId: string): Promise<void> {
    try {
        const response = await fetch('/api/plugins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pluginId, action: 'deactivate' })
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 플러그인 비활성화 실패:', { pluginId, error });
        throw error;
    }
}

export async function deletePlugin(pluginId: string): Promise<void> {
    try {
        const response = await fetch(`/api/plugins/${pluginId}`, {
            method: 'DELETE'
        });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 플러그인 삭제 실패:', { pluginId, error });
        throw error;
    }
}

export async function getPluginSettings(
    pluginId: string
): Promise<{ settings: Record<string, unknown>; schema: Record<string, unknown> }> {
    try {
        const response = await fetch(`/api/plugins/${pluginId}/settings`);
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

export async function setPluginSettings(
    pluginId: string,
    settings: Record<string, unknown>
): Promise<void> {
    try {
        const response = await fetch(`/api/plugins/${pluginId}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings })
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ 플러그인 설정 저장 실패:', { pluginId, error });
        throw error;
    }
}
