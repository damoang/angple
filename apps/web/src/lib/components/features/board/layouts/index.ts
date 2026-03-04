/**
 * Board Layout System — 공개 API
 *
 * WordPress의 Template Hierarchy에서 영감을 받은 레이아웃 시스템.
 *
 * @example
 * ```ts
 * import { layoutRegistry, initCoreLayouts } from '$lib/components/features/board/layouts';
 *
 * // 초기화 (앱 시작 시 1회)
 * initCoreLayouts();
 *
 * // 목록 레이아웃 resolve
 * const listEntry = layoutRegistry.resolveList('gallery');
 * const ListComponent = listEntry?.component;
 *
 * // 본문 레이아웃 resolve
 * const viewEntry = layoutRegistry.resolveView('basic');
 * const ViewComponent = viewEntry?.component;
 *
 * // 관리자 UI에서 선택지 표시
 * const listManifests = layoutRegistry.getListManifests();
 * const viewManifests = layoutRegistry.getViewManifests();
 * ```
 */

import { registerCoreListLayouts } from './list/index.js';
import { registerCoreViewLayouts } from './view/index.js';

export { layoutRegistry } from './registry.js';
export { registerCoreListLayouts } from './list/index.js';
export { registerCoreViewLayouts } from './view/index.js';
export type {
    LayoutManifest,
    LayoutEntry,
    LayoutSource,
    ListLayoutId,
    ViewLayoutId,
    ListLayoutProps,
    ViewLayoutProps
} from './types.js';

/**
 * 코어 레이아웃 초기화 (앱 시작 시 1회 호출)
 */
export function initCoreLayouts(): void {
    registerCoreListLayouts();
    registerCoreViewLayouts();
}
