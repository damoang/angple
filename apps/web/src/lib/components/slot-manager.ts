/**
 * Component 슬롯 시스템
 *
 * 테마가 특정 위치에 커스텀 컴포넌트를 주입할 수 있게 합니다.
 * WordPress의 위젯 영역(widget areas)과 유사한 개념입니다.
 */

import type { Component } from 'svelte';

/**
 * 슬롯에 등록되는 컴포넌트 정의
 */
export interface SlotComponent {
    /** 고유 식별자 */
    id: string;
    /** Svelte 컴포넌트 */
    component: Component;
    /** 우선순위 (낮을수록 먼저 렌더링) */
    priority: number;
    /** 컴포넌트에 전달할 props (선택 사항) */
    props?: Record<string, unknown>;
    /** 등록 소스 (테마 ID 등) */
    source?: string;
}

/**
 * 사용 가능한 슬롯 포인트 — angple Plugin Slot Catalog
 *
 * WordPress `do_action` / Shopify Theme App Extension / Discourse Plugin Outlets
 * 모범 사례 따라 사전 풍부한 slot 라이브러리 제공. plugin 이 매번 core PR 없이
 * `plugin.json` `components[].slot` 으로 등록만 하면 동작.
 *
 * 명명 규약: `<area>-<object>-<position>`
 *   position: before / after / prepend / append / top / middle / bottom /
 *             left / center / right / actions / meta / toolbar / header
 *
 * `custom-${string}` template — plugin 끼리 자유 협업용 사용자 정의 slot.
 * 표준 slot 이름 충돌 회피 위해 plugin 개발자는 `custom-{pluginId}-{slot}` 권장.
 *
 * 분석/근거: /home/damoang/docs/2026-05-17-plugin-slot-architecture-research.md
 */
export type StandardSlotName =
    // ── 글로벌 layout (10) ──
    | 'header-before' // 헤더 위
    | 'header-after' // 헤더 아래
    | 'header-actions-left' // 헤더 좌측 액션 영역
    | 'header-actions-center' // 헤더 중앙 액션 영역
    | 'header-actions-right' // 헤더 우측 액션 영역
    | 'footer-before' // 푸터 위
    | 'footer-after' // 푸터 아래
    | 'body-start' // <body> 직후 (analytics, modal 마운트 등)
    | 'body-end' // </body> 직전
    | 'sidebar-banner' // 사이드바 배너 (기존)
    // ── 사이드바 (6) ──
    | 'sidebar-left-top'
    | 'sidebar-left-middle'
    | 'sidebar-left-bottom'
    | 'sidebar-right-top'
    | 'sidebar-right-middle'
    | 'sidebar-right-bottom'
    // ── 콘텐츠 영역 ──
    | 'content-before'
    | 'content-after'
    | 'background'
    // ── 게시판 목록 (8) ──
    | 'board-list-banner' // 목록 상단 배너 (기존)
    | 'board-list-rolling' // 목록 헤더 아래 롤링 (기존)
    | 'board-list-promotion' // 인라인 홍보글 (기존)
    | 'board-list-filter-before'
    | 'board-list-filter-after'
    | 'board-list-item-prepend' // 글 카드 좌측/위
    | 'board-list-item-append' // 글 카드 우측/아래
    | 'board-list-empty' // 빈 상태
    // ── 글 상세 (12) ──
    | 'board-view-banner' // 글 상세 상단 배너 (기존)
    | 'board-view-rolling' // 글 상세 롤링 (기존)
    | 'post-detail-before'
    | 'post-detail-header-after'
    | 'post-detail-content-before'
    | 'post-detail-content-after'
    | 'post-detail-extra' // 본문 아래 추가 영역 (기존, archive/giving 등 사용 중)
    | 'post-detail-actions' // 공유/신고/보존 등 액션 묶음
    | 'post-detail-tags'
    | 'post-detail-reactions-after'
    | 'post-detail-related'
    | 'post-detail-comments-before'
    | 'post-detail-comments-after'
    | 'post-detail-after'
    // ── 댓글 (9) ──
    | 'comments-header'
    | 'comments-form-before'
    | 'comments-form-toolbar'
    | 'comments-form-after'
    | 'comments-list-before'
    | 'comments-list-after'
    | 'comments-item-prepend'
    | 'comments-item-append'
    | 'comments-item-actions'
    // ── 회원 프로필 (5) ──
    | 'member-profile-header'
    | 'member-profile-stats' // 통계 영역 (archive plugin 등)
    | 'member-profile-tabs-before'
    | 'member-profile-tabs-after'
    | 'member-profile-actions'
    // ── 글쓰기 폼 (5) ──
    | 'write-form-before'
    | 'write-form-title-after'
    | 'write-form-toolbar'
    | 'write-form-editor-after'
    | 'write-form-after'
    // ── 메인/랜딩 (4) ──
    | 'landing-hero' // 기존
    | 'landing-content' // 기존
    | 'home-content-before'
    | 'home-content-after'
    // ── 인증 / 검색 (3) ──
    | 'auth-login-after'
    | 'auth-signup-after'
    | 'search-results-before'
    // ── 어드민 (3) ──
    | 'admin-sidebar-after'
    | 'admin-dashboard-widgets'
    | 'admin-settings-tabs';

/**
 * Plugin 끼리 자유 협업용 사용자 정의 slot.
 * 권장 명명: `custom-{pluginId}-{slot}` (예: `custom-archive-profile-stats`).
 */
export type CustomSlotName = `custom-${string}`;

export type SlotName = StandardSlotName | CustomSlotName;

/**
 * Component 슬롯 레지스트리
 */
class SlotRegistry {
    /** 슬롯별 컴포넌트 저장소 */
    private slots: Map<SlotName, SlotComponent[]> = new Map();

    /** 변경 감지를 위한 버전 (변경될 때마다 증가) */
    private version = 0;

    /** 변경 리스너들 */
    private listeners: Set<() => void> = new Set();

    /**
     * 변경 알림
     */
    private notifyChange(): void {
        this.version++;
        this.listeners.forEach((listener) => listener());
    }

    /**
     * 변경 리스너 구독
     */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * 현재 버전 가져오기
     */
    getVersion(): number {
        return this.version;
    }

    /**
     * 컴포넌트를 슬롯에 등록
     */
    register(
        slotName: SlotName,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        component: Component<any>,
        priority: number = 10,
        props?: Record<string, unknown>,
        source?: string
    ): void {
        if (!this.slots.has(slotName)) {
            this.slots.set(slotName, []);
        }

        const componentList = this.slots.get(slotName)!;
        const sourceKey = source || 'anonymous';
        const componentName =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((component as any)?.name as string | undefined)?.toLowerCase() || 'component';
        const occurrence = componentList.filter(
            (comp) =>
                comp.source === source && comp.priority === priority && comp.component === component
        ).length;
        const id = `${slotName}-${sourceKey}-${componentName}-${priority}-${occurrence}`;

        componentList.push({
            id,
            component,
            priority,
            props,
            source
        });

        // Priority 순으로 정렬 (낮은 숫자가 먼저)
        componentList.sort((a, b) => a.priority - b.priority);

        this.notifyChange();
    }

    /**
     * 특정 슬롯에 등록된 모든 컴포넌트 가져오기
     */
    getComponents(slotName: SlotName): SlotComponent[] {
        return this.slots.get(slotName) || [];
    }

    /**
     * 특정 슬롯에 등록된 컴포넌트 개수
     */
    getComponentCount(slotName: SlotName): number {
        return this.getComponents(slotName).length;
    }

    /**
     * 특정 소스(테마)의 모든 컴포넌트 제거
     */
    removeComponentsBySource(source: string): void {
        for (const [slotName, componentList] of this.slots.entries()) {
            const filtered = componentList.filter((comp) => comp.source !== source);
            this.slots.set(slotName, filtered);

            if (filtered.length === 0) {
                this.slots.delete(slotName);
            }
        }

        this.notifyChange();
    }

    /**
     * 특정 ID의 컴포넌트 제거
     */
    removeComponentById(id: string): void {
        for (const [slotName, componentList] of this.slots.entries()) {
            const filtered = componentList.filter((comp) => comp.id !== id);
            this.slots.set(slotName, filtered);

            if (filtered.length === 0) {
                this.slots.delete(slotName);
            }
        }

        this.notifyChange();
    }

    /**
     * 모든 슬롯의 모든 컴포넌트 제거
     */
    clearAll(): void {
        this.slots.clear();
        this.notifyChange();
    }

    /**
     * 등록된 모든 슬롯 목록 가져오기
     */
    getAllSlots(): Map<SlotName, SlotComponent[]> {
        return this.slots;
    }

    /**
     * 디버깅용: 모든 슬롯 정보 출력
     */
    debug(): void {
        console.log('[Slot Manager] Current slots:');
        for (const [slotName, componentList] of this.slots.entries()) {
            console.log('  Slot:', { name: slotName, count: componentList.length });
            componentList.forEach((comp) => {
                console.log(
                    `    - ${comp.id} (priority: ${comp.priority}, source: ${comp.source})`
                );
            });
        }
    }
}

/**
 * 싱글톤 인스턴스
 */
const slotRegistry = new SlotRegistry();

/**
 * 컴포넌트를 슬롯에 등록
 */
export const registerComponent = (
    slotName: SlotName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: Component<any>,
    priority: number = 10,
    props?: Record<string, unknown>,
    source?: string
) => {
    slotRegistry.register(slotName, component, priority, props, source);
};

/**
 * 슬롯에 등록된 컴포넌트 가져오기
 */
export const getComponentsForSlot = (slotName: SlotName): SlotComponent[] => {
    return slotRegistry.getComponents(slotName);
};

/**
 * 특정 소스의 모든 컴포넌트 제거
 */
export const removeComponentsBySource = (source: string): void => {
    slotRegistry.removeComponentsBySource(source);
};

/**
 * 특정 ID의 컴포넌트 제거
 */
export const removeComponentById = (id: string): void => {
    slotRegistry.removeComponentById(id);
};

/**
 * 모든 슬롯 초기화
 */
export const clearAllSlots = (): void => {
    slotRegistry.clearAll();
};

/**
 * 디버깅용
 */
export const debugSlots = (): void => {
    slotRegistry.debug();
};

/**
 * 슬롯 변경 구독
 */
export const subscribeToSlotChanges = (listener: () => void): (() => void) => {
    return slotRegistry.subscribe(listener);
};

/**
 * 슬롯 버전 가져오기 (리액티브 트래킹용)
 */
export const getSlotVersion = (): number => {
    return slotRegistry.getVersion();
};
