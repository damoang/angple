/**
 * WordPress 스타일 Hook 시스템
 *
 * 테마가 코어 기능을 확장할 수 있도록 이벤트 기반 아키텍처를 제공합니다.
 */

import { incrementHookVersion } from './hook-state.svelte';

/**
 * Hook 타입 정의
 */
export type HookType = 'action' | 'filter';

/**
 * Hook 콜백 함수 타입
 */
export type HookCallback = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Hook 정의
 */
export interface Hook {
    /** Hook 이름 */
    name: string;
    /** Hook 타입 (action 또는 filter) */
    type: HookType;
    /** 실행할 콜백 함수 */
    callback: HookCallback;
    /** 우선순위 (낮은 숫자가 먼저 실행) */
    priority: number;
    /** Hook을 등록한 주체 (테마 ID 등) */
    source?: string;
}

/**
 * Hook 레지스트리 (싱글톤)
 */
class HookRegistry {
    private hooks: Map<string, Hook[]> = new Map();
    private static instance: HookRegistry;

    private constructor() {}

    /**
     * 싱글톤 인스턴스 가져오기
     */
    static getInstance(): HookRegistry {
        if (!HookRegistry.instance) {
            HookRegistry.instance = new HookRegistry();
        }
        return HookRegistry.instance;
    }

    /**
     * Hook 등록
     */
    register(
        name: string,
        callback: HookCallback,
        priority: number = 10,
        source?: string,
        type: HookType = 'action'
    ): void {
        if (!this.hooks.has(name)) {
            this.hooks.set(name, []);
        }

        const hook: Hook = {
            name,
            type,
            callback,
            priority,
            source
        };

        const hookList = this.hooks.get(name)!;
        hookList.push(hook);

        // Priority 순서로 정렬 (낮은 숫자가 먼저)
        hookList.sort((a, b) => a.priority - b.priority);

        // Reactive 버전 증가 (구독 중인 컴포넌트의 $effect 재실행)
        incrementHookVersion();
    }

    /**
     * Action Hook 실행
     *
     * 등록된 모든 콜백을 순서대로 실행합니다 (반환값 없음)
     */
    async doAction(name: string, ...args: unknown[]): Promise<void> {
        const hookList = this.hooks.get(name);

        if (!hookList || hookList.length === 0) {
            return;
        }

        for (const hook of hookList) {
            try {
                await hook.callback(...args);
            } catch (error) {
                console.error('[Hook] Error in action hook:', {
                    name,
                    source: hook.source || 'unknown',
                    error
                });
            }
        }
    }

    /**
     * Filter Hook 실행
     *
     * 등록된 모든 콜백을 순서대로 실행하여 값을 변환합니다
     */
    async applyFilter<T>(name: string, value: T, ...args: unknown[]): Promise<T> {
        const hookList = this.hooks.get(name);

        if (!hookList || hookList.length === 0) {
            return value;
        }

        let currentValue = value;

        for (const hook of hookList) {
            try {
                const result = await hook.callback(currentValue, ...args);
                currentValue = result !== undefined ? (result as T) : currentValue;
            } catch (error) {
                console.error('[Hook] Error in filter hook:', {
                    name,
                    source: hook.source || 'unknown',
                    error
                });
            }
        }

        return currentValue;
    }

    /**
     * 특정 Hook의 모든 콜백 제거
     */
    removeHook(name: string): void {
        this.hooks.delete(name);
    }

    /**
     * 특정 소스의 모든 Hook 제거 (테마 비활성화 시 사용)
     */
    removeHooksBySource(source: string): void {
        for (const [name, hookList] of this.hooks.entries()) {
            const filtered = hookList.filter((hook) => hook.source !== source);

            if (filtered.length < hookList.length) {
                this.hooks.set(name, filtered);
            }

            // Hook 목록이 비었으면 삭제
            if (filtered.length === 0) {
                this.hooks.delete(name);
            }
        }
    }

    /**
     * 모든 Hook 제거
     */
    clear(): void {
        this.hooks.clear();
    }

    /**
     * 등록된 Hook 목록 조회 (디버깅용)
     */
    getHooks(name?: string): Hook[] {
        if (name) {
            return this.hooks.get(name) || [];
        }

        // 모든 Hook 반환
        const allHooks: Hook[] = [];
        for (const hookList of this.hooks.values()) {
            allHooks.push(...hookList);
        }
        return allHooks;
    }

    /**
     * 등록된 Hook 이름 목록
     */
    getHookNames(): string[] {
        return Array.from(this.hooks.keys());
    }
}

// 싱글톤 인스턴스 export
const hookRegistry = HookRegistry.getInstance();

/**
 * Hook 등록 (편의 함수)
 */
export function registerHook(
    name: string,
    callback: HookCallback,
    priority: number = 10,
    source?: string,
    type: HookType = 'action'
): void {
    hookRegistry.register(name, callback, priority, source, type);
}

/**
 * Action Hook 실행 (편의 함수)
 */
export async function doAction(name: string, ...args: unknown[]): Promise<void> {
    await hookRegistry.doAction(name, ...args);
}

/**
 * Filter Hook 실행 (편의 함수)
 */
export async function applyFilter<T>(name: string, value: T, ...args: unknown[]): Promise<T> {
    return await hookRegistry.applyFilter(name, value, ...args);
}

/**
 * Hook 제거 (편의 함수)
 */
export function removeHook(name: string): void {
    hookRegistry.removeHook(name);
}

/**
 * 특정 소스의 Hook 제거 (편의 함수)
 */
export function removeHooksBySource(source: string): void {
    hookRegistry.removeHooksBySource(source);
}

/**
 * 모든 Hook 제거 (편의 함수)
 */
export function clearHooks(): void {
    hookRegistry.clear();
}

/**
 * Hook 목록 조회 (편의 함수)
 */
export function getHooks(name?: string): Hook[] {
    return hookRegistry.getHooks(name);
}

/**
 * Hook 이름 목록 조회 (편의 함수)
 */
export function getHookNames(): string[] {
    return hookRegistry.getHookNames();
}

// 레지스트리 인스턴스도 export (고급 사용자용)
export { hookRegistry };
