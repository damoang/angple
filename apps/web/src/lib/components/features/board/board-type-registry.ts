/**
 * Board Type Registry
 *
 * board_type 기반으로 특수 게시판 컴포넌트를 동적으로 로딩하는 레지스트리.
 * 플러그인이 자신의 게시판 타입 컴포넌트를 등록하면,
 * [boardId]/+page.svelte에서 하드코딩 없이 동적으로 로딩한다.
 *
 * @example
 * ```ts
 * // 플러그인에서 등록
 * boardTypeRegistry.register('giving', GivingBoard);
 *
 * // 코어에서 resolve
 * const component = boardTypeRegistry.resolve('giving');
 * // → GivingBoard 컴포넌트 또는 null
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BoardComponent = any;

interface BoardTypeEntry {
    component: BoardComponent;
    source: 'core' | 'plugin';
}

class BoardTypeRegistry {
    private static instance: BoardTypeRegistry;
    private types: Map<string, BoardTypeEntry> = new Map();

    private constructor() {}

    static getInstance(): BoardTypeRegistry {
        if (!BoardTypeRegistry.instance) {
            BoardTypeRegistry.instance = new BoardTypeRegistry();
        }
        return BoardTypeRegistry.instance;
    }

    /**
     * 게시판 타입 컴포넌트 등록
     *
     * @param boardType - 게시판 타입 (예: 'giving', 'auction')
     * @param component - 해당 타입의 전용 컴포넌트
     * @param source - 등록 소스 ('core' | 'plugin'), plugin이 core를 오버라이드
     */
    register(
        boardType: string,
        component: BoardComponent,
        source: 'core' | 'plugin' = 'plugin'
    ): void {
        const existing = this.types.get(boardType);

        // plugin 소스가 core를 오버라이드
        if (existing && existing.source === 'plugin' && source === 'core') {
            return; // 이미 플러그인이 등록한 경우 코어 등록 무시
        }

        this.types.set(boardType, { component, source });
    }

    /**
     * 게시판 타입에 해당하는 컴포넌트 resolve
     *
     * @param boardType - 게시판 타입
     * @returns 등록된 컴포넌트 또는 null (standard 게시판은 null)
     */
    resolve(boardType: string): BoardComponent | null {
        if (boardType === 'standard') return null;
        const entry = this.types.get(boardType);
        return entry?.component ?? null;
    }

    /**
     * 특정 소스의 모든 등록 제거 (플러그인 비활성화 시)
     */
    removeBySource(source: 'core' | 'plugin'): void {
        for (const [key, entry] of this.types) {
            if (entry.source === source) {
                this.types.delete(key);
            }
        }
    }

    /**
     * 등록된 모든 게시판 타입 목록
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.types.keys());
    }
}

/** 싱글톤 인스턴스 */
export const boardTypeRegistry = BoardTypeRegistry.getInstance();
