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
export type {
	ApiEndpoint,
	Migration,
	PluginManifest,
	ActivePlugin
} from './plugin.js';

// Hook types
export type {
	HookType,
	HookDefinition,
	ActionHookPoints,
	FilterHookPoints,
	HookContext
} from './hook.js';
