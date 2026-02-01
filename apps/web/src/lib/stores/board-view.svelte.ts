/**
 * 게시판 뷰 모드 스토어
 *
 * 뷰 우선순위:
 * 1. 사용자 선호 (localStorage)
 * 2. 게시판 설정 (서버)
 * 3. 테마 기본값 ('list')
 */

import { browser } from '$app/environment';

/** 지원하는 뷰 모드 */
export type BoardViewMode = 'list' | 'card' | 'gallery' | 'compact' | 'timeline';

/** 뷰 모드 메타데이터 */
export interface ViewModeInfo {
    id: BoardViewMode;
    label: string;
    icon: string;
    description: string;
}

/** 사용 가능한 뷰 모드 목록 */
export const VIEW_MODES: ViewModeInfo[] = [
    { id: 'list', label: '리스트', icon: 'list', description: '기본 목록 형태' },
    { id: 'card', label: '카드', icon: 'layout-grid', description: '카드 그리드 형태' },
    { id: 'gallery', label: '갤러리', icon: 'image', description: '이미지 중심 갤러리' },
    { id: 'compact', label: '컴팩트', icon: 'align-justify', description: '밀집된 텍스트 목록' },
    { id: 'timeline', label: '타임라인', icon: 'clock', description: '시간순 타임라인' }
];

const STORAGE_KEY = 'angple-board-view-prefs';
const DEFAULT_VIEW: BoardViewMode = 'list';

class BoardViewStore {
    /** 게시판별 사용자 선호 뷰 모드 */
    private userPrefs = $state<Record<string, BoardViewMode>>({});

    /** 게시판별 서버 기본 뷰 모드 */
    private boardDefaults = $state<Record<string, BoardViewMode>>({});

    constructor() {
        if (browser) {
            this.loadFromStorage();
        }
    }

    /**
     * localStorage에서 선호 설정 로드
     */
    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.userPrefs = JSON.parse(stored);
            }
        } catch {
            // 파싱 실패 시 무시
        }
    }

    /**
     * localStorage에 선호 설정 저장
     */
    private saveToStorage(): void {
        if (!browser) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.userPrefs));
        } catch {
            // 저장 실패 시 무시
        }
    }

    /**
     * 게시판의 현재 뷰 모드 가져오기 (우선순위 적용)
     */
    getViewMode(boardId: string): BoardViewMode {
        // 1. 사용자 선호
        if (this.userPrefs[boardId]) {
            return this.userPrefs[boardId];
        }
        // 2. 게시판 서버 기본값
        if (this.boardDefaults[boardId]) {
            return this.boardDefaults[boardId];
        }
        // 3. 전역 기본값
        return DEFAULT_VIEW;
    }

    /**
     * 사용자 뷰 모드 선호 설정
     */
    setViewMode(boardId: string, mode: BoardViewMode): void {
        this.userPrefs[boardId] = mode;
        this.saveToStorage();
    }

    /**
     * 사용자 선호 초기화 (서버 기본값으로 복귀)
     */
    resetViewMode(boardId: string): void {
        delete this.userPrefs[boardId];
        this.saveToStorage();
    }

    /**
     * 게시판 서버 기본 뷰 모드 설정 (관리자)
     */
    setBoardDefault(boardId: string, mode: BoardViewMode): void {
        this.boardDefaults[boardId] = mode;
    }

    /**
     * 서버에서 게시판 기본값 일괄 로드
     */
    initBoardDefaults(defaults: Record<string, BoardViewMode>): void {
        this.boardDefaults = { ...defaults };
    }

    /**
     * 전역 기본 뷰 모드 가져오기
     */
    getGlobalViewMode(): BoardViewMode {
        return this.userPrefs['__global'] ?? DEFAULT_VIEW;
    }

    /**
     * 전역 기본 뷰 모드 설정
     */
    setGlobalViewMode(mode: BoardViewMode): void {
        this.userPrefs['__global'] = mode;
        this.saveToStorage();
    }
}

/** 전역 스토어 인스턴스 */
export const boardViewStore = new BoardViewStore();
