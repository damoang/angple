/**
 * 게시판 즐겨찾기(단축키) 스토어
 *
 * 숫자키 1-0 (슬롯 1-10) + Shift+1-0 (슬롯 11-20) = 총 20슬롯
 * localStorage 기반, ang-gnu의 customUi shortcut 시스템 이식
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple-board-favorites';

/** 단축키 슬롯 (1-10: 일반, 11-20: Shift) */
export type SlotNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20;

export interface FavoriteEntry {
    boardId: string;
    title: string;
}

/** 일반 슬롯 번호 (1-0 키에 대응) */
export const NORMAL_SLOTS: SlotNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
/** Shift 슬롯 번호 (Shift+1-0 키에 대응) */
export const SHIFT_SLOTS: SlotNumber[] = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

/** 슬롯 번호 → 표시 라벨 */
export function slotLabel(slot: SlotNumber): string {
    if (slot <= 10) return slot === 10 ? '0' : String(slot);
    const shifted = slot - 10;
    return shifted === 10 ? 'S+0' : `S+${shifted}`;
}

class BoardFavoritesStore {
    private favorites = $state<Partial<Record<SlotNumber, FavoriteEntry>>>({});

    constructor() {
        if (browser) {
            this.loadFromStorage();
        }
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.favorites = JSON.parse(stored);
            }
        } catch {
            // 파싱 실패 시 무시
        }
    }

    private saveToStorage(): void {
        if (!browser) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites));
        } catch {
            // 저장 실패 시 무시
        }
    }

    /** 전체 즐겨찾기 조회 */
    get all(): Partial<Record<SlotNumber, FavoriteEntry>> {
        return this.favorites;
    }

    /** 일반 슬롯만 조회 (사이드바 표시용) */
    get normalSlots(): { slot: SlotNumber; entry: FavoriteEntry }[] {
        return NORMAL_SLOTS
            .filter((s) => this.favorites[s])
            .map((s) => ({ slot: s, entry: this.favorites[s]! }));
    }

    /** Shift 슬롯만 조회 */
    get shiftSlots(): { slot: SlotNumber; entry: FavoriteEntry }[] {
        return SHIFT_SLOTS
            .filter((s) => this.favorites[s])
            .map((s) => ({ slot: s, entry: this.favorites[s]! }));
    }

    /** 특정 슬롯 조회 */
    getSlot(slot: SlotNumber): FavoriteEntry | undefined {
        return this.favorites[slot];
    }

    /** 게시판이 등록된 슬롯 번호 반환 (없으면 null) */
    findSlot(boardId: string): SlotNumber | null {
        for (const slot of [...NORMAL_SLOTS, ...SHIFT_SLOTS]) {
            if (this.favorites[slot]?.boardId === boardId) {
                return slot;
            }
        }
        return null;
    }

    /** 게시판이 즐겨찾기에 등록되어 있는지 */
    isFavorite(boardId: string): boolean {
        return this.findSlot(boardId) !== null;
    }

    /** 빈 슬롯 중 가장 작은 번호 반환 (일반 → Shift 순) */
    findEmptySlot(): SlotNumber | null {
        for (const slot of [...NORMAL_SLOTS, ...SHIFT_SLOTS]) {
            if (!this.favorites[slot]) return slot;
        }
        return null;
    }

    /** 슬롯에 즐겨찾기 등록 */
    setSlot(slot: SlotNumber, boardId: string, title: string): void {
        this.favorites = { ...this.favorites, [slot]: { boardId, title } };
        this.saveToStorage();
    }

    /** 슬롯 해제 */
    removeSlot(slot: SlotNumber): void {
        const next = { ...this.favorites };
        delete next[slot];
        this.favorites = next;
        this.saveToStorage();
    }

    /** boardId로 해제 */
    removeByBoardId(boardId: string): SlotNumber | null {
        const slot = this.findSlot(boardId);
        if (slot !== null) {
            this.removeSlot(slot);
        }
        return slot;
    }

    /**
     * 빈 슬롯에 자동 등록 (성공 시 슬롯 번호 반환)
     */
    addAuto(boardId: string, title: string): SlotNumber | null {
        const slot = this.findEmptySlot();
        if (slot !== null) {
            this.setSlot(slot, boardId, title);
        }
        return slot;
    }

    /**
     * 키보드 단축키 서비스용 매핑 생성
     * @returns { '1': '/free', '2': '/trade', ... } 형태
     */
    toShortcutMap(): { normal: Record<string, string>; shift: Record<string, string> } {
        const normal: Record<string, string> = {};
        const shift: Record<string, string> = {};

        for (const slot of NORMAL_SLOTS) {
            const entry = this.favorites[slot];
            if (entry) {
                const digit = slot === 10 ? '0' : String(slot);
                normal[digit] = `/${entry.boardId}`;
            }
        }

        for (const slot of SHIFT_SLOTS) {
            const entry = this.favorites[slot];
            if (entry) {
                const digit = (slot - 10) === 10 ? '0' : String(slot - 10);
                shift[digit] = `/${entry.boardId}`;
            }
        }

        return { normal, shift };
    }

    /** 전체 초기화 */
    clear(): void {
        this.favorites = {};
        this.saveToStorage();
    }
}

export const boardFavoritesStore = new BoardFavoritesStore();
