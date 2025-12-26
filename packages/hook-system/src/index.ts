/**
 * @angple/hook-system
 * 워드프레스 스타일 Hook 시스템 (Actions & Filters)
 */

export { HookManager, hooks } from './hook-manager.js';
export type {
	ActionCallback,
	FilterCallback,
	Hook,
	RegisteredHooks,
	HookPoints,
	FilterPoints
} from './types.js';
