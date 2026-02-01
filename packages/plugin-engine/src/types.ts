/**
 * Plugin Engine 타입 정의
 */

import type { HookManager } from '@angple/hook-system';

/**
 * 플러그인 권한 목록
 */
export type PluginPermission =
    | 'posts:read'
    | 'posts:write'
    | 'posts:delete'
    | 'comments:read'
    | 'comments:write'
    | 'comments:delete'
    | 'users:read'
    | 'users:write'
    | 'users:delete'
    | 'settings:read'
    | 'settings:write'
    | 'files:read'
    | 'files:write'
    | 'files:delete'
    | 'api:external'
    | 'database:read'
    | 'database:write'
    | 'network:fetch'
    | 'network:websocket';

/**
 * 플러그인 매니페스트 (plugin-engine 내부용 최소 인터페이스)
 */
export interface PluginManifestInfo {
    id: string;
    name: string;
    version: string;
    description?: string;
    permissions?: PluginPermission[];
    settings?: Record<string, PluginSettingField>;
}

/**
 * 플러그인 설정 필드 정의
 */
export interface PluginSettingField {
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'url' | 'color' | 'email';
    label: string;
    description?: string;
    default?: unknown;
    required?: boolean;
    options?: string[] | { label: string; value: string }[];
    min?: number;
    max?: number;
    placeholder?: string;
}

/**
 * 등록된 플러그인 정보
 */
export interface RegisteredPlugin {
    manifest: PluginManifestInfo;
    active: boolean;
    settings: Record<string, unknown>;
    activatedAt?: Date;
    slots: Map<string, SlotRegistration>;
}

/**
 * 슬롯 등록 정보
 */
export interface SlotRegistration {
    slotName: string;
    component: unknown;
    priority: number;
    pluginId: string;
}

/**
 * 플러그인 로거 인터페이스
 */
export interface PluginLogger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

/**
 * ExtensionContext - 플러그인에 주입되는 컨텍스트
 */
export interface ExtensionContext {
    /** Hook 매니저 (action/filter 등록) */
    hooks: HookManager;

    /** 플러그인 설정 접근 */
    settings: {
        get(key: string): unknown;
        set(key: string, value: unknown): void;
        getAll(): Record<string, unknown>;
    };

    /** 권한 검증 */
    permissions: {
        check(permission: PluginPermission): boolean;
        getGranted(): PluginPermission[];
    };

    /** UI 슬롯 등록 */
    ui: {
        registerSlot(name: string, component: unknown, priority?: number): void;
        removeSlot(name: string): void;
    };

    /** 로거 */
    logger: PluginLogger;

    /** 플러그인 메타데이터 */
    pluginId: string;
    pluginVersion: string;
}

/**
 * 플러그인 초기화 함수 시그니처
 */
export type PluginInitFunction = (context: ExtensionContext) => void | Promise<void>;

/**
 * 플러그인 정리 함수 시그니처
 */
export type PluginCleanupFunction = () => void | Promise<void>;
