/**
 * @angple/plugin-engine
 *
 * 플러그인 엔진 코어 - 레지스트리, 컨텍스트, 권한 관리
 */

export { PluginRegistry } from './plugin-registry.js';
export { createExtensionContext } from './plugin-context.js';
export {
    PermissionManager,
    PermissionDeniedError,
    DANGEROUS_PERMISSIONS,
    HOOK_PERMISSION_MAP
} from './permission-manager.js';
export type { AuditEntry } from './permission-manager.js';
export type {
    ExtensionContext,
    PluginInitFunction,
    PluginCleanupFunction,
    PluginManifestInfo,
    PluginPermission,
    PluginSettingField,
    PluginLogger,
    RegisteredPlugin,
    SlotRegistration
} from './types.js';
