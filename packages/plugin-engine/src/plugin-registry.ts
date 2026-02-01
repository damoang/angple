/**
 * Plugin Registry
 *
 * 전역 플러그인 레지스트리. 활성 플러그인, 훅 매핑, UI 슬롯을 관리합니다.
 */

import { HookManager } from '@angple/hook-system';
import { PermissionManager } from './permission-manager.js';
import { createExtensionContext } from './plugin-context.js';
import type {
    ExtensionContext,
    PluginInitFunction,
    PluginCleanupFunction,
    PluginManifestInfo,
    PluginPermission,
    RegisteredPlugin,
    SlotRegistration
} from './types.js';

export class PluginRegistry {
    /** 등록된 플러그인 맵 */
    private plugins: Map<string, RegisteredPlugin> = new Map();

    /** 플러그인별 정리 함수 */
    private cleanupFunctions: Map<string, PluginCleanupFunction> = new Map();

    /** 플러그인별 ExtensionContext */
    private contexts: Map<string, ExtensionContext> = new Map();

    /** 전역 Hook 매니저 */
    private globalHooks: HookManager;

    /** 권한 매니저 */
    private permissionManager: PermissionManager;

    /** UI 슬롯 레지스트리 */
    private slotRegistry: Map<string, SlotRegistration[]> = new Map();

    /** 설정 변경 콜백 */
    private onSettingsChange?: (pluginId: string, key: string, value: unknown) => void;

    constructor(
        globalHooks?: HookManager,
        options?: {
            onSettingsChange?: (pluginId: string, key: string, value: unknown) => void;
        }
    ) {
        this.globalHooks = globalHooks ?? new HookManager();
        this.permissionManager = new PermissionManager();
        this.onSettingsChange = options?.onSettingsChange;
    }

    /**
     * 플러그인 등록 (아직 활성화하지 않음)
     */
    register(manifest: PluginManifestInfo, settings?: Record<string, unknown>): void {
        if (this.plugins.has(manifest.id)) {
            console.warn('[PluginRegistry] 이미 등록된 플러그인: %s', manifest.id);
            return;
        }

        this.plugins.set(manifest.id, {
            manifest,
            active: false,
            settings: settings ?? {},
            slots: new Map()
        });
    }

    /**
     * 플러그인 활성화 + 초기화 함수 실행
     */
    async activate(
        pluginId: string,
        initFn?: PluginInitFunction,
        cleanupFn?: PluginCleanupFunction
    ): Promise<ExtensionContext | null> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            console.error('[PluginRegistry] 등록되지 않은 플러그인: %s', pluginId);
            return null;
        }

        if (plugin.active) {
            console.warn('[PluginRegistry] 이미 활성화된 플러그인: %s', pluginId);
            return this.contexts.get(pluginId) ?? null;
        }

        // 권한 부여
        if (plugin.manifest.permissions) {
            this.permissionManager.grant(pluginId, plugin.manifest.permissions);
        }

        // ExtensionContext 생성
        const context = createExtensionContext(
            plugin.manifest,
            this.globalHooks,
            this.permissionManager,
            plugin.settings,
            this.slotRegistry,
            this.onSettingsChange
        );

        this.contexts.set(pluginId, context);

        // 초기화 함수 실행 (에러 격리)
        if (initFn) {
            try {
                await initFn(context);
            } catch (error) {
                console.error('[PluginRegistry] 플러그인 초기화 실패: %s', pluginId, error);
                this.permissionManager.revoke(pluginId);
                this.contexts.delete(pluginId);
                return null;
            }
        }

        // 정리 함수 저장
        if (cleanupFn) {
            this.cleanupFunctions.set(pluginId, cleanupFn);
        }

        plugin.active = true;
        plugin.activatedAt = new Date();

        console.log('[PluginRegistry] 플러그인 활성화: %s', pluginId);
        return context;
    }

    /**
     * 플러그인 비활성화
     */
    async deactivate(pluginId: string): Promise<boolean> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin || !plugin.active) {
            return false;
        }

        // 정리 함수 실행
        const cleanup = this.cleanupFunctions.get(pluginId);
        if (cleanup) {
            try {
                await cleanup();
            } catch (error) {
                console.error('[PluginRegistry] 플러그인 정리 실패: %s', pluginId, error);
            }
        }

        // UI 슬롯에서 해당 플러그인 컴포넌트 제거
        for (const [slotName, registrations] of this.slotRegistry) {
            const filtered = registrations.filter((r) => r.pluginId !== pluginId);
            this.slotRegistry.set(slotName, filtered);
        }

        // 권한 회수
        this.permissionManager.revoke(pluginId);

        // 컨텍스트 제거
        this.contexts.delete(pluginId);
        this.cleanupFunctions.delete(pluginId);

        plugin.active = false;
        console.log('[PluginRegistry] 플러그인 비활성화: %s', pluginId);
        return true;
    }

    /**
     * 플러그인 등록 해제 (완전 제거)
     */
    async unregister(pluginId: string): Promise<void> {
        await this.deactivate(pluginId);
        this.plugins.delete(pluginId);
    }

    /**
     * 등록된 플러그인 조회
     */
    getPlugin(pluginId: string): RegisteredPlugin | undefined {
        return this.plugins.get(pluginId);
    }

    /**
     * 활성 플러그인 목록 조회
     */
    getActivePlugins(): RegisteredPlugin[] {
        return Array.from(this.plugins.values()).filter((p) => p.active);
    }

    /**
     * 모든 등록된 플러그인 목록
     */
    getAllPlugins(): RegisteredPlugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * 특정 플러그인의 ExtensionContext 조회
     */
    getContext(pluginId: string): ExtensionContext | undefined {
        return this.contexts.get(pluginId);
    }

    /**
     * 특정 슬롯에 등록된 컴포넌트 조회
     */
    getSlotComponents(slotName: string): SlotRegistration[] {
        return this.slotRegistry.get(slotName) ?? [];
    }

    /**
     * 모든 슬롯 이름 조회
     */
    getRegisteredSlots(): string[] {
        return Array.from(this.slotRegistry.keys());
    }

    /**
     * 전역 Hook 매니저 접근
     */
    getHookManager(): HookManager {
        return this.globalHooks;
    }

    /**
     * 권한 매니저 접근
     */
    getPermissionManager(): PermissionManager {
        return this.permissionManager;
    }

    /**
     * 플러그인 설정 업데이트
     */
    updateSettings(pluginId: string, settings: Record<string, unknown>): void {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            plugin.settings = { ...plugin.settings, ...settings };
        }
    }

    /**
     * 모든 플러그인 비활성화 및 초기화
     */
    async clearAll(): Promise<void> {
        const pluginIds = Array.from(this.plugins.keys());
        for (const id of pluginIds) {
            await this.deactivate(id);
        }
        this.plugins.clear();
        this.slotRegistry.clear();
    }
}
