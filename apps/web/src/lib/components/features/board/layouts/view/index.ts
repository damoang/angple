/**
 * 본문(View) 레이아웃 코어 등록
 *
 * 코어 뷰 레이아웃을 Layout Registry에 등록한다.
 * 테마/플러그인은 동일 ID로 등록하여 오버라이드 가능.
 */

import { layoutRegistry } from '../registry.js';
import type { LayoutManifest } from '../types.js';

import BasicView from './basic.svelte';
import ReportView from './report.svelte';

/** 코어 본문 레이아웃 매니페스트 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const coreViewLayouts: { manifest: LayoutManifest; component: any }[] = [
    {
        manifest: {
            id: 'basic',
            name: '기본',
            description: '카드형 기본 레이아웃'
        },
        component: BasicView
    },
    {
        manifest: {
            id: 'report',
            name: '운영 리포트',
            description: '통계 대시보드 형태의 운영 리포트'
        },
        component: ReportView
    }
];

/**
 * 코어 본문 레이아웃을 레지스트리에 등록
 */
export function registerCoreViewLayouts(): void {
    for (const { manifest, component } of coreViewLayouts) {
        layoutRegistry.registerView(manifest, component, 'core');
    }
}

// 컴포넌트 개별 export (하위호환)
export { BasicView, ReportView };
