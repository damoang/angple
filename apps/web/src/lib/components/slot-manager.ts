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
 * 사용 가능한 슬롯 포인트
 */
export type SlotName =
    | 'header-before' // 헤더 상단
    | 'header-after' // 헤더 하단
    | 'sidebar-left-top' // 왼쪽 사이드바 상단
    | 'sidebar-left-bottom' // 왼쪽 사이드바 하단
    | 'sidebar-right-top' // 오른쪽 사이드바 상단
    | 'sidebar-right-bottom' // 오른쪽 사이드바 하단
    | 'content-before' // 메인 콘텐츠 상단
    | 'content-after' // 메인 콘텐츠 하단
    | 'footer-before' // 푸터 상단
    | 'footer-after' // 푸터 하단
    | 'background' // 배경 (테마용)
    | 'landing-hero' // 랜딩 히어로 (테마용)
    | 'landing-content'; // 랜딩 콘텐츠 (테마용)

/**
 * Component 슬롯 레지스트리
 *
 * 각 슬롯 포인트에 등록된 컴포넌트를 관리합니다.
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
     *
     * @param slotName - 슬롯 이름
     * @param component - Svelte 컴포넌트
     * @param priority - 우선순위 (기본값: 10)
     * @param props - 컴포넌트에 전달할 props (선택 사항)
     * @param source - 등록 소스 (테마 ID 등)
     */
    register(
        slotName: SlotName,
        component: Component,
        priority: number = 10,
        props?: Record<string, unknown>,
        source?: string
    ): void {
        // 슬롯이 없으면 생성
        if (!this.slots.has(slotName)) {
            this.slots.set(slotName, []);
        }

        const componentList = this.slots.get(slotName)!;

        // 고유 ID 생성 (타임스탬프 + 랜덤)
        const id = `${slotName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

        componentList.push({
            id,
            component,
            priority,
            props,
            source
        });

        // Priority 순으로 정렬 (낮은 숫자가 먼저)
        componentList.sort((a, b) => a.priority - b.priority);

        console.log(
            `✅ [Slot Manager] Registered component to "${slotName}" (priority: ${priority}, source: ${source || 'unknown'})`
        );

        // 변경 알림
        this.notifyChange();
    }

    /**
     * 특정 슬롯에 등록된 모든 컴포넌트 가져오기
     *
     * @param slotName - 슬롯 이름
     * @returns 등록된 컴포넌트 배열 (priority 순 정렬됨)
     */
    getComponents(slotName: SlotName): SlotComponent[] {
        return this.slots.get(slotName) || [];
    }

    /**
     * 특정 슬롯에 등록된 컴포넌트 개수
     *
     * @param slotName - 슬롯 이름
     * @returns 컴포넌트 개수
     */
    getComponentCount(slotName: SlotName): number {
        return this.getComponents(slotName).length;
    }

    /**
     * 특정 소스(테마)의 모든 컴포넌트 제거
     *
     * @param source - 제거할 소스 (테마 ID 등)
     */
    removeComponentsBySource(source: string): void {
        for (const [slotName, componentList] of this.slots.entries()) {
            const filtered = componentList.filter((comp) => comp.source !== source);
            this.slots.set(slotName, filtered);

            // 빈 슬롯은 제거
            if (filtered.length === 0) {
                this.slots.delete(slotName);
            }
        }

        console.log(`🗑️ [Slot Manager] Removed all components from source: ${source}`);
        this.notifyChange();
    }

    /**
     * 특정 ID의 컴포넌트 제거
     *
     * @param id - 컴포넌트 ID
     */
    removeComponentById(id: string): void {
        for (const [slotName, componentList] of this.slots.entries()) {
            const filtered = componentList.filter((comp) => comp.id !== id);
            this.slots.set(slotName, filtered);

            if (filtered.length === 0) {
                this.slots.delete(slotName);
            }
        }

        console.log(`🗑️ [Slot Manager] Removed component: ${id}`);
        this.notifyChange();
    }

    /**
     * 모든 슬롯의 모든 컴포넌트 제거
     */
    clearAll(): void {
        this.slots.clear();
        console.log('🗑️ [Slot Manager] Cleared all slots');
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
        console.log('🔍 [Slot Manager] Current slots:');
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
    component: Component,
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
