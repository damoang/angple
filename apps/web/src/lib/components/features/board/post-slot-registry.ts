/**
 * Post Slot Registry
 *
 * 게시글 상세 페이지에서 특정 슬롯 위치에 플러그인 컴포넌트를 삽입하는 레지스트리.
 * 예: 나눔 게시판의 BidPanel을 post.after_content 슬롯에 삽입
 *
 * @example
 * ```ts
 * // 플러그인에서 등록
 * postSlotRegistry.register('post.after_content', {
 *     component: BidPanel,
 *     condition: (boardType) => boardType === 'giving',
 *     priority: 10,
 *     propsMapper: (data) => ({
 *         postId: data.post.id,
 *         boardId: data.boardId,
 *         ...
 *     })
 * });
 *
 * // 코어에서 resolve
 * const slots = postSlotRegistry.resolve('post.after_content', boardType);
 * ```
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SlotComponent = any;

export interface SlotEntry {
    /** 중복 등록 방지용 고유 ID (미지정 시 component 참조로 대체) */
    id?: string;
    component: SlotComponent;
    /** 이 슬롯을 표시할 조건 (boardType 기반) */
    condition?: (boardType: string) => boolean;
    /** 우선순위 (낮을수록 먼저 렌더링) */
    priority: number;
    /** 페이지 data를 컴포넌트 props로 변환 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propsMapper?: (data: any) => Record<string, unknown>;
}

class PostSlotRegistry {
    private static instance: PostSlotRegistry;
    private slots: Map<string, SlotEntry[]> = new Map();

    private constructor() {}

    static getInstance(): PostSlotRegistry {
        if (!PostSlotRegistry.instance) {
            PostSlotRegistry.instance = new PostSlotRegistry();
        }
        return PostSlotRegistry.instance;
    }

    /**
     * 슬롯에 컴포넌트 등록
     */
    register(slotName: string, entry: SlotEntry): void {
        const entries = this.slots.get(slotName) || [];
        // 중복 등록 방지: id 기반 우선, 없으면 component 참조로 비교
        // SPA 이동 시 +page.svelte 스크립트가 인스턴스마다 재실행되므로 필수
        const isDuplicate = entry.id
            ? entries.some((e) => e.id === entry.id)
            : entries.some((e) => e.component === entry.component);
        if (isDuplicate) return;
        entries.push(entry);
        // 우선순위로 정렬
        entries.sort((a, b) => a.priority - b.priority);
        this.slots.set(slotName, entries);
    }

    /**
     * 특정 슬롯의 활성 컴포넌트 목록 resolve
     */
    resolve(slotName: string, boardType: string): SlotEntry[] {
        const entries = this.slots.get(slotName) || [];
        return entries.filter((entry) => !entry.condition || entry.condition(boardType));
    }

    /**
     * 슬롯 초기화 (테스트용)
     */
    clear(slotName?: string): void {
        if (slotName) {
            this.slots.delete(slotName);
        } else {
            this.slots.clear();
        }
    }
}

/** 싱글톤 인스턴스 */
export const postSlotRegistry = PostSlotRegistry.getInstance();
