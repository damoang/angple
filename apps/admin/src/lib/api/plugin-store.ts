/**
 * Backend Plugin Store API 클라이언트
 *
 * Go 백엔드의 플러그인 스토어 API를 호출합니다.
 * 백엔드 플러그인(commerce, marketplace 등)의 설치/활성화/비활성화/제거를 관리합니다.
 */

// Vite 프록시를 통해 백엔드 API 호출 (CORS 우회)
const PLUGIN_STORE_API_URL = '/api/v2/admin/plugins';

// ============================================
// 타입 정의
// ============================================

export interface CatalogPlugin {
    name: string;
    version: string;
    title: string;
    description: string;
    author: string;
    license: string;
    category: string;
    icon: string;
    tags: string[] | null;
    dependencies: string[];
    conflicts: string[] | null;
    settings: PluginSettingSchema[] | null;
    is_installed: boolean;
    status: string; // 'enabled' | 'disabled' | 'error' | ''
}

export interface PluginSettingSchema {
    Key: string;
    Type: string;
    Default: unknown;
    Label: string;
    Min: number | null;
    Max: number | null;
    Options: unknown[] | null;
}

export interface PluginSetting {
    key: string;
    label: string;
    type: string;
    value: unknown;
    default_value: unknown;
    description?: string;
}

export interface PluginEvent {
    id: number;
    plugin_name: string;
    event_type: string;
    details: Record<string, unknown> | null;
    actor_id: string | null;
    created_at: string;
}

// ============================================
// API 함수
// ============================================

/**
 * 플러그인 카탈로그 목록 조회
 */
export async function listPlugins(): Promise<CatalogPlugin[]> {
    const response = await fetch(PLUGIN_STORE_API_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
}

/**
 * 플러그인 상세 조회
 */
export async function getPlugin(name: string): Promise<CatalogPlugin> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.data;
}

/**
 * 플러그인 설치
 */
export async function installPlugin(name: string): Promise<void> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}/install`, {
        method: 'POST'
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `HTTP ${response.status}`);
    }
}

/**
 * 플러그인 활성화
 */
export async function enablePlugin(name: string): Promise<void> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}/enable`, {
        method: 'POST'
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `HTTP ${response.status}`);
    }
}

/**
 * 플러그인 비활성화
 */
export async function disablePlugin(name: string): Promise<void> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}/disable`, {
        method: 'POST'
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `HTTP ${response.status}`);
    }
}

/**
 * 플러그인 제거
 */
export async function uninstallPlugin(name: string): Promise<void> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `HTTP ${response.status}`);
    }
}

/**
 * 플러그인 설정 조회
 */
export async function getSettings(name: string): Promise<PluginSetting[]> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}/settings`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
}

/**
 * 플러그인 설정 저장
 */
export async function saveSettings(name: string, settings: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
    });
    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || `HTTP ${response.status}`);
    }
}

/**
 * 플러그인 이벤트 로그 조회
 */
export async function getEvents(name: string): Promise<PluginEvent[]> {
    const response = await fetch(`${PLUGIN_STORE_API_URL}/${name}/events`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return data.data || [];
}
