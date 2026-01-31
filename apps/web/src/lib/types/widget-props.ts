/**
 * 위젯 컴포넌트 표준 인터페이스
 *
 * 모든 위젯은 이 Props를 받습니다.
 * 데이터는 자체 fetch 또는 SSR prefetch 데이터를 사용합니다.
 */

import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';

export type WidgetSlot = 'main' | 'sidebar' | 'header' | 'footer';

export interface WidgetProps {
    /** 위젯 인스턴스 설정 */
    config: WidgetConfig;
    /** 배치 슬롯 */
    slot: WidgetSlot;
    /** 편집 모드 여부 */
    isEditMode?: boolean;
    /** SSR prefetch 데이터 (있으면 사용, 없으면 자체 fetch) */
    prefetchData?: unknown;
}
