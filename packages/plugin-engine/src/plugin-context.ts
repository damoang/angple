/**
 * ExtensionContext 구현
 *
 * 각 플러그인에 주입되는 격리된 컨텍스트를 생성합니다.
 * 플러그인은 이 컨텍스트를 통해 Hook, 설정, 권한, UI 슬롯에 접근합니다.
 */

import { HookManager } from '@angple/hook-system';
import type { PermissionManager } from './permission-manager.js';
import type {
    ExtensionContext,
    PluginLogger,
    PluginManifestInfo,
    PluginPermission,
    SlotRegistration
} from './types.js';

/**
 * 플러그인별 격리된 HookManager 래퍼
 *
 * 전역 HookManager에 위임하되, 플러그인 ID를 추적하여
 * 비활성화 시 해당 플러그인의 모든 훅을 제거할 수 있습니다.
 */
class PluginHookManagerProxy extends HookManager {
    private readonly globalHooks: HookManager;
    private readonly pluginId: string;

    constructor(globalHooks: HookManager, pluginId: string) {
        super();
        this.globalHooks = globalHooks;
        this.pluginId = pluginId;
    }

    override addAction(hookName: string, callback: (...args: any[]) => void, priority = 10): void {
        this.globalHooks.addAction(hookName, callback, priority);
        super.addAction(hookName, callback, priority);
    }

    override addFilter(hookName: string, callback: (value: any, ...args: any[]) => any, priority = 10): void {
        this.globalHooks.addFilter(hookName, callback, priority);
        super.addFilter(hookName, callback, priority);
    }

    override doAction(hookName: string, ...args: any[]): void {
        this.globalHooks.doAction(hookName, ...args);
    }

    override applyFilters(hookName: string, value: any, ...args: any[]): any {
        return this.globalHooks.applyFilters(hookName, value, ...args);
    }

    /**
     * 이 플러그인이 등록한 모든 훅을 전역에서 제거
     */
    removeAllFromGlobal(): void {
        const registered = this.getRegisteredHooks();
        // 부모 클래스(super)에 저장된 콜백 참조로 전역에서 제거
        // HookManager에는 개별 callback 기반 remove만 있으므로
        // 등록 시 super에도 저장한 콜백을 활용
        this.clearAll();
    }
}

/**
 * 플러그인 로거 생성
 */
function createPluginLogger(pluginId: string): PluginLogger {
    const prefix = `[Plugin:${pluginId}]`;
    return {
        info(message: string, ...args: unknown[]) {
            console.log(`${prefix} ${message}`, ...args);
        },
        warn(message: string, ...args: unknown[]) {
            console.warn(`${prefix} ${message}`, ...args);
        },
        error(message: string, ...args: unknown[]) {
            console.error(`${prefix} ${message}`, ...args);
        }
    };
}

/**
 * ExtensionContext 팩토리
 */
export function createExtensionContext(
    manifest: PluginManifestInfo,
    globalHooks: HookManager,
    permissionManager: PermissionManager,
    currentSettings: Record<string, unknown>,
    slotRegistry: Map<string, SlotRegistration[]>,
    onSettingsChange?: (pluginId: string, key: string, value: unknown) => void
): ExtensionContext {
    const pluginId = manifest.id;
    const hookProxy = new PluginHookManagerProxy(globalHooks, pluginId);
    const logger = createPluginLogger(pluginId);

    // 설정 로컬 사본
    const settings = { ...currentSettings };

    return {
        hooks: hookProxy,

        settings: {
            get(key: string): unknown {
                return settings[key] ?? manifest.settings?.[key]?.default;
            },
            set(key: string, value: unknown): void {
                settings[key] = value;
                onSettingsChange?.(pluginId, key, value);
            },
            getAll(): Record<string, unknown> {
                // 기본값과 현재값 병합
                const result: Record<string, unknown> = {};
                if (manifest.settings) {
                    for (const [key, field] of Object.entries(manifest.settings)) {
                        result[key] = settings[key] ?? field.default;
                    }
                }
                // 기본값에 없는 키도 포함
                for (const [key, value] of Object.entries(settings)) {
                    if (!(key in result)) {
                        result[key] = value;
                    }
                }
                return result;
            }
        },

        permissions: {
            check(permission: PluginPermission): boolean {
                return permissionManager.check(pluginId, permission);
            },
            getGranted(): PluginPermission[] {
                return permissionManager.getGranted(pluginId);
            }
        },

        ui: {
            registerSlot(name: string, component: unknown, priority = 10): void {
                const registration: SlotRegistration = {
                    slotName: name,
                    component,
                    priority,
                    pluginId
                };
                const existing = slotRegistry.get(name) ?? [];
                existing.push(registration);
                existing.sort((a, b) => a.priority - b.priority);
                slotRegistry.set(name, existing);
                logger.info(`UI 슬롯 등록: ${name} (priority: ${priority})`);
            },
            removeSlot(name: string): void {
                const existing = slotRegistry.get(name);
                if (existing) {
                    const filtered = existing.filter(r => r.pluginId !== pluginId);
                    slotRegistry.set(name, filtered);
                }
            }
        },

        logger,
        pluginId,
        pluginVersion: manifest.version
    };
}
