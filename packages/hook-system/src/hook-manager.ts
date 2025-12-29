/**
 * Frontend Hook System
 * 워드프레스 스타일 Action/Filter 구현
 */

type ActionCallback = (...args: any[]) => void;
type FilterCallback = (value: any, ...args: any[]) => any;

interface Hook {
    callback: ActionCallback | FilterCallback;
    priority: number;
}

export class HookManager {
    private actions: Map<string, Hook[]> = new Map();
    private filters: Map<string, Hook[]> = new Map();

    /**
     * Action 등록
     * @param hookName - Hook 이름
     * @param callback - 실행할 콜백 함수
     * @param priority - 우선순위 (낮을수록 먼저 실행)
     */
    addAction(hookName: string, callback: ActionCallback, priority: number = 10): void {
        if (!this.actions.has(hookName)) {
            this.actions.set(hookName, []);
        }

        const hooks = this.actions.get(hookName)!;
        hooks.push({ callback, priority });
        hooks.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Action 실행
     * @param hookName - Hook 이름
     * @param args - 콜백에 전달할 인자
     */
    doAction(hookName: string, ...args: any[]): void {
        const hooks = this.actions.get(hookName);
        if (!hooks) return;

        for (const hook of hooks) {
            try {
                (hook.callback as ActionCallback)(...args);
            } catch (error) {
                console.error('Error in action:', { hookName, error });
            }
        }
    }

    /**
     * Filter 등록
     * @param hookName - Hook 이름
     * @param callback - 값을 변환할 콜백 함수
     * @param priority - 우선순위
     */
    addFilter(hookName: string, callback: FilterCallback, priority: number = 10): void {
        if (!this.filters.has(hookName)) {
            this.filters.set(hookName, []);
        }

        const hooks = this.filters.get(hookName)!;
        hooks.push({ callback, priority });
        hooks.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Filter 적용
     * @param hookName - Hook 이름
     * @param value - 변환할 초기 값
     * @param args - 추가 인자
     * @returns 변환된 값
     */
    applyFilters(hookName: string, value: any, ...args: any[]): any {
        const hooks = this.filters.get(hookName);
        if (!hooks) return value;

        let result = value;
        for (const hook of hooks) {
            try {
                result = (hook.callback as FilterCallback)(result, ...args);
            } catch (error) {
                console.error('Error in filter:', { hookName, error });
            }
        }

        return result;
    }

    /**
     * Action Hook 제거
     */
    removeAction(hookName: string, callback: ActionCallback): void {
        const hooks = this.actions.get(hookName);
        if (!hooks) return;

        const index = hooks.findIndex((h) => h.callback === callback);
        if (index !== -1) {
            hooks.splice(index, 1);
        }
    }

    /**
     * Filter Hook 제거
     */
    removeFilter(hookName: string, callback: FilterCallback): void {
        const hooks = this.filters.get(hookName);
        if (!hooks) return;

        const index = hooks.findIndex((h) => h.callback === callback);
        if (index !== -1) {
            hooks.splice(index, 1);
        }
    }

    /**
     * 모든 등록된 Hook 조회 (디버깅용)
     */
    getRegisteredHooks(): { actions: string[]; filters: string[] } {
        return {
            actions: Array.from(this.actions.keys()),
            filters: Array.from(this.filters.keys())
        };
    }

    /**
     * 특정 Hook의 등록된 콜백 개수 확인
     */
    getHookCount(hookName: string, type: 'action' | 'filter'): number {
        if (type === 'action') {
            return this.actions.get(hookName)?.length || 0;
        }
        return this.filters.get(hookName)?.length || 0;
    }

    /**
     * 모든 Hook 초기화 (테스트용)
     */
    clearAll(): void {
        this.actions.clear();
        this.filters.clear();
    }
}

// 글로벌 싱글톤 인스턴스
export const hooks = new HookManager();
