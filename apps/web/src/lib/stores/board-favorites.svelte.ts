/**
 * 게시판 즐겨찾기(단축키) 스토어
 *
 * 숫자키 1-0 (슬롯 1-10) + Shift+1-0 (슬롯 11-20) = 총 20슬롯
 * 로그인 시 서버 동기화, 비로그인 시 localStorage 기반
 */

import { browser } from '$app/environment';
import { apiClient } from '$lib/api/client';
import { debounce } from '$lib/utils/autosave';

const STORAGE_KEY = 'angple-board-favorites';

/** 단축키 슬롯 (1-10: 일반, 11-20: Shift) */
export type SlotNumber =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20;

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

type FavoritesMap = Partial<Record<SlotNumber, FavoriteEntry>>;

/** Record<string, FavoriteEntry> ↔ Partial<Record<SlotNumber, FavoriteEntry>> 변환 */
function fromRecord(rec: Record<string, FavoriteEntry>): FavoritesMap {
    const map: FavoritesMap = {};
    for (const [key, val] of Object.entries(rec)) {
        const slot = Number(key) as SlotNumber;
        if (slot >= 1 && slot <= 20) {
            map[slot] = val;
        }
    }
    return map;
}

function toRecord(map: FavoritesMap): Record<string, FavoriteEntry> {
    const rec: Record<string, FavoriteEntry> = {};
    for (const [key, val] of Object.entries(map)) {
        if (val) rec[key] = val;
    }
    return rec;
}

class BoardFavoritesStore {
    private favorites = $state<FavoritesMap>({});
    private loggedIn = false;
    private syncing = false;

    /** 서버 동기화 (debounce 500ms) */
    private debouncedSync = debounce(() => {
        this.syncToServer();
    }, 500);
    /** debounce 발화 대기 중인 변경이 있는지 (#12912 flush 판단용) */
    private pendingSync = false;

    constructor() {
        if (browser) {
            this.loadFromStorage();
            // #12912: 삭제 등 변경은 persist()에서 500ms debounce로 서버에 저장되는데,
            // debounce 발화 전 탭 전환/종료/새로고침이 일어나면 서버에 삭제가 전달되지 않는다.
            // 이후 재로그인 시 syncFromServer()가 (타임스탬프 비교 없이) 서버 데이터를 로컬에
            // 무조건 덮어써 삭제한 항목이 부활한다. 페이지가 숨겨지거나 이탈할 때 대기 중인
            // 동기화를 즉시 flush 하여(keepalive 로 unload 중에도 전송 보장) 유실을 막는다.
            const flush = () => {
                if (this.loggedIn && this.pendingSync) {
                    void this.syncToServer(true);
                }
            };
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') flush();
            });
            window.addEventListener('pagehide', flush);
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

    /** 로그인 상태 설정 + 서버 동기화 트리거 */
    setLoggedIn(loggedIn: boolean): void {
        this.loggedIn = loggedIn;
        if (loggedIn && browser) {
            this.syncFromServer();
        }
    }

    /** 서버에서 즐겨찾기 로드 → $state + localStorage 동시 업데이트 */
    async syncFromServer(): Promise<void> {
        if (!browser || !this.loggedIn || this.syncing) return;
        this.syncing = true;
        try {
            const serverData = await apiClient.getFavorites();
            const hasServerData = Object.keys(serverData).length > 0;

            if (hasServerData) {
                // 서버 데이터 우선 (Last Write Wins)
                this.favorites = fromRecord(serverData);
                this.saveToStorage();
            } else {
                // 서버에 데이터 없고 localStorage에 있으면 마이그레이션
                await this.migrateLocalToServer();
            }
        } catch {
            // 서버 동기화 실패 시 localStorage 유지
        } finally {
            this.syncing = false;
        }
    }

    /** localStorage → 서버로 마이그레이션 */
    private async migrateLocalToServer(): Promise<void> {
        const hasLocal = Object.keys(this.favorites).length > 0;
        if (!hasLocal) return;
        try {
            await apiClient.saveFavorites(toRecord(this.favorites));
        } catch {
            // 마이그레이션 실패 시 무시 (다음 로그인 시 재시도)
        }
    }

    /** 현재 상태를 서버에 저장 (keepalive: 페이지 이탈 중에도 전송 보장) */
    private async syncToServer(keepalive = false): Promise<void> {
        if (!browser || !this.loggedIn) return;
        this.pendingSync = false;
        try {
            await apiClient.saveFavorites(toRecord(this.favorites), keepalive);
        } catch {
            // 서버 저장 실패 시 무시 (localStorage에는 이미 저장됨)
        }
    }

    /** 변경 후 공통 저장 로직 */
    private persist(): void {
        this.saveToStorage();
        if (this.loggedIn) {
            this.pendingSync = true;
            this.debouncedSync();
        }
    }

    /** 전체 즐겨찾기 조회 */
    get all(): FavoritesMap {
        return this.favorites;
    }

    /** 일반 슬롯만 조회 (사이드바 표시용) */
    get normalSlots(): { slot: SlotNumber; entry: FavoriteEntry }[] {
        return NORMAL_SLOTS.filter((s) => this.favorites[s]).map((s) => ({
            slot: s,
            entry: this.favorites[s]!
        }));
    }

    /** Shift 슬롯만 조회 */
    get shiftSlots(): { slot: SlotNumber; entry: FavoriteEntry }[] {
        return SHIFT_SLOTS.filter((s) => this.favorites[s]).map((s) => ({
            slot: s,
            entry: this.favorites[s]!
        }));
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
        this.persist();
    }

    /** 슬롯 해제 */
    removeSlot(slot: SlotNumber): void {
        const next = { ...this.favorites };
        delete next[slot];
        this.favorites = next;
        this.persist();
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
                const digit = slot - 10 === 10 ? '0' : String(slot - 10);
                shift[digit] = `/${entry.boardId}`;
            }
        }

        return { normal, shift };
    }

    /** 전체 초기화 */
    clear(): void {
        this.favorites = {};
        this.persist();
    }
}

export const boardFavoritesStore = new BoardFavoritesStore();
