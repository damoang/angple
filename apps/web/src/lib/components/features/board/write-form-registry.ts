/**
 * Write Form Registry
 *
 * board_type 기반으로 커스텀 글쓰기 폼 컴포넌트를 동적으로 로딩하는 레지스트리.
 * 플러그인이 자신의 글쓰기 폼을 등록하면,
 * [boardId]/write/+page.svelte에서 하드코딩 없이 동적으로 로딩한다.
 *
 * @example
 * ```ts
 * // 플러그인에서 등록
 * writeFormRegistry.register('giving', GivingWriteForm, 'plugin');
 *
 * // 코어에서 resolve
 * const component = writeFormRegistry.resolve('giving');
 * // → GivingWriteForm 컴포넌트 또는 null (null이면 기본 PostForm 사용)
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WriteFormComponent = any;

interface WriteFormEntry {
    component: WriteFormComponent;
    source: 'core' | 'plugin';
}

class WriteFormRegistry {
    private static instance: WriteFormRegistry;
    private forms: Map<string, WriteFormEntry> = new Map();

    private constructor() {}

    static getInstance(): WriteFormRegistry {
        if (!WriteFormRegistry.instance) {
            WriteFormRegistry.instance = new WriteFormRegistry();
        }
        return WriteFormRegistry.instance;
    }

    /**
     * 글쓰기 폼 컴포넌트 등록
     *
     * @param boardType - 게시판 타입 (예: 'giving', 'auction')
     * @param component - 해당 타입의 전용 글쓰기 폼 컴포넌트
     * @param source - 등록 소스 ('core' | 'plugin'), plugin이 core를 오버라이드
     */
    register(
        boardType: string,
        component: WriteFormComponent,
        source: 'core' | 'plugin' = 'plugin'
    ): void {
        const existing = this.forms.get(boardType);

        // plugin 소스가 core를 오버라이드
        if (existing && existing.source === 'plugin' && source === 'core') {
            return; // 이미 플러그인이 등록한 경우 코어 등록 무시
        }

        this.forms.set(boardType, { component, source });
    }

    /**
     * 게시판 타입에 해당하는 글쓰기 폼 컴포넌트 resolve
     *
     * @param boardType - 게시판 타입
     * @returns 등록된 글쓰기 폼 컴포넌트 또는 null (standard 게시판은 null → 기본 PostForm)
     */
    resolve(boardType: string): WriteFormComponent | null {
        if (boardType === 'standard') return null;
        const entry = this.forms.get(boardType);
        return entry?.component ?? null;
    }

    /**
     * 특정 소스의 모든 등록 제거 (플러그인 비활성화 시)
     */
    removeBySource(source: 'core' | 'plugin'): void {
        for (const [key, entry] of this.forms) {
            if (entry.source === source) {
                this.forms.delete(key);
            }
        }
    }

    /**
     * 등록된 모든 글쓰기 폼 타입 목록
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.forms.keys());
    }
}

/** 싱글톤 인스턴스 */
export const writeFormRegistry = WriteFormRegistry.getInstance();
