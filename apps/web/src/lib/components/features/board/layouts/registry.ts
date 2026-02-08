/**
 * Board Layout Registry
 *
 * WordPress의 Template Hierarchy처럼 동작하는 레이아웃 레지스트리.
 * 코어, 테마, 플러그인이 각각 레이아웃을 등록하고,
 * 동일 ID가 여러 소스에서 등록되면 Plugin > Theme > Core 순으로 우선한다.
 *
 * @example
 * ```ts
 * // 코어에서 등록
 * layoutRegistry.registerList({ id: 'compact', name: '컴팩트', ... }, CompactLayout, 'core');
 *
 * // 테마에서 오버라이드
 * layoutRegistry.registerList({ id: 'compact', name: '커스텀 컴팩트', ... }, MyCompactLayout, 'theme');
 *
 * // resolve 시 테마 버전이 반환됨
 * const entry = layoutRegistry.resolveList('compact'); // → 테마의 MyCompactLayout
 * ```
 */

import type {
    LayoutEntry,
    LayoutManifest,
    LayoutSource,
    ListLayoutId,
    ViewLayoutId
} from './types.js';

/** 소스 우선순위 (높을수록 우선) */
const SOURCE_PRIORITY: Record<LayoutSource, number> = {
    core: 0,
    theme: 1,
    plugin: 2
};

class LayoutRegistry {
    private static instance: LayoutRegistry;
    private listLayouts: Map<string, LayoutEntry[]> = new Map();
    private viewLayouts: Map<string, LayoutEntry[]> = new Map();

    private constructor() {}

    static getInstance(): LayoutRegistry {
        if (!LayoutRegistry.instance) {
            LayoutRegistry.instance = new LayoutRegistry();
        }
        return LayoutRegistry.instance;
    }

    /**
     * 목록 레이아웃 등록
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerList(manifest: LayoutManifest, component: any, source: LayoutSource = 'core'): void {
        const entries = this.listLayouts.get(manifest.id) || [];
        // 동일 소스의 중복 등록 방지
        if (entries.some((e) => e.source === source)) return;
        entries.push({ manifest, component, source });
        this.listLayouts.set(manifest.id, entries);
    }

    /**
     * 본문 레이아웃 등록
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerView(manifest: LayoutManifest, component: any, source: LayoutSource = 'core'): void {
        const entries = this.viewLayouts.get(manifest.id) || [];
        if (entries.some((e) => e.source === source)) return;
        entries.push({ manifest, component, source });
        this.viewLayouts.set(manifest.id, entries);
    }

    /**
     * 목록 레이아웃 resolve (Plugin > Theme > Core)
     *
     * @param id - 레이아웃 ID
     * @returns 가장 우선순위 높은 LayoutEntry, 없으면 'compact' 폴백
     */
    resolveList(id: ListLayoutId): LayoutEntry | null {
        return this.resolve(this.listLayouts, id) || this.resolve(this.listLayouts, 'compact');
    }

    /**
     * 본문 레이아웃 resolve (Plugin > Theme > Core)
     */
    resolveView(id: ViewLayoutId): LayoutEntry | null {
        return this.resolve(this.viewLayouts, id) || this.resolve(this.viewLayouts, 'basic');
    }

    /**
     * 등록된 모든 목록 레이아웃 매니페스트 (관리자 UI용)
     */
    getListManifests(): LayoutManifest[] {
        const manifests: LayoutManifest[] = [];
        for (const [id] of this.listLayouts) {
            const entry = this.resolve(this.listLayouts, id);
            if (entry) manifests.push(entry.manifest);
        }
        return manifests;
    }

    /**
     * 등록된 모든 본문 레이아웃 매니페스트 (관리자 UI용)
     */
    getViewManifests(): LayoutManifest[] {
        const manifests: LayoutManifest[] = [];
        for (const [id] of this.viewLayouts) {
            const entry = this.resolve(this.viewLayouts, id);
            if (entry) manifests.push(entry.manifest);
        }
        return manifests;
    }

    /**
     * 특정 소스의 레이아웃 모두 제거 (테마/플러그인 비활성화 시)
     */
    removeBySource(source: LayoutSource): void {
        for (const [id, entries] of this.listLayouts) {
            const filtered = entries.filter((e) => e.source !== source);
            if (filtered.length === 0) {
                this.listLayouts.delete(id);
            } else {
                this.listLayouts.set(id, filtered);
            }
        }
        for (const [id, entries] of this.viewLayouts) {
            const filtered = entries.filter((e) => e.source !== source);
            if (filtered.length === 0) {
                this.viewLayouts.delete(id);
            } else {
                this.viewLayouts.set(id, filtered);
            }
        }
    }

    /**
     * 내부: 우선순위 기반 resolve
     */
    private resolve(map: Map<string, LayoutEntry[]>, id: string): LayoutEntry | null {
        const entries = map.get(id);
        if (!entries || entries.length === 0) return null;

        // 가장 높은 우선순위 소스 선택
        return entries.reduce((best, entry) =>
            SOURCE_PRIORITY[entry.source] > SOURCE_PRIORITY[best.source] ? entry : best
        );
    }
}

/** 싱글톤 인스턴스 */
export const layoutRegistry = LayoutRegistry.getInstance();
