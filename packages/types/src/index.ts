/**
 * @angple/types - Angple 테마/플러그인 시스템 공통 타입
 */

// Theme types
export type {
    ComponentSlot,
    ComponentDefinition,
    ThemeSettings,
    ThemeManifest,
    ActiveTheme,
    ThemeRepository
} from './theme.js';

// Plugin types
export type { ApiEndpoint, Migration, PluginManifest, ActivePlugin } from './plugin.js';

// Hook types
export type {
    HookType,
    HookDefinition,
    ActionHookPoints,
    FilterHookPoints,
    HookContext
} from './hook.js';

// Extension types
export { ExtensionType, PluginType, ExtensionPermission, ExtensionStatus } from './extension.js';

export type {
    ExtensionCategory,
    ExtensionAuthor,
    ExtensionRepository,
    ExtensionSettingType,
    ExtensionSettingField,
    ExtensionHook,
    ExtensionComponent,
    ExtensionAPIRoute,
    ExtensionRESTAPI,
    ExtensionGraphQLAPI,
    ExtensionAPI,
    ExtensionAdminMenu,
    ExtensionAdminUI,
    ExtensionEditorUI,
    ExtensionUI,
    ExtensionEngines,
    ExtensionManifest,
    ExtensionRuntime,
    ExtensionInstallOptions,
    ExtensionSearchFilter
} from './extension.js';

// Extension Zod schemas (runtime validation)
export {
    ExtensionManifestSchema,
    validateExtensionManifest,
    safeValidateExtensionManifest,
    PartialExtensionManifestSchema,
    ExtensionAuthorSchema,
    ExtensionRepositorySchema,
    ExtensionEnginesSchema,
    ExtensionSettingFieldSchema,
    ExtensionHookSchema,
    ExtensionComponentSchema,
    ExtensionAPIRouteSchema,
    ExtensionRESTAPISchema,
    ExtensionGraphQLAPISchema,
    ExtensionAPISchema,
    ExtensionAdminMenuSchema,
    ExtensionAdminUISchema,
    ExtensionEditorUISchema,
    ExtensionUISchema
} from './extension-schema.js';

export type { ExtensionManifestValidated, PartialExtensionManifest } from './extension-schema.js';
