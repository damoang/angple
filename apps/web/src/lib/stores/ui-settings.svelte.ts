/**
 * 개인화면설정 통합 스토어
 *
 * localStorage 기반으로 사용자의 UI 개인화 설정을 저장합니다.
 * 키: angple_ui_settings
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple_ui_settings';

export type FontFamily = 'default' | 'pretendard' | 'nanum-gothic' | 'noto-sans';
export type LineHeight = 'compact' | 'normal' | 'relaxed' | 'loose';
export type ShortcutButtonSize = 'small' | 'medium' | 'large';
export type ListViewMode = 'classic' | 'modern';
export type ContentFontSize = 'small' | 'base' | 'large' | 'xlarge' | '2xlarge' | '3xlarge';
export type ListFontSize = 'xsmall' | 'small' | 'base' | 'large' | 'xlarge';

export interface UiSettings {
    // 레이아웃
    titleBold: boolean;
    listView: ListViewMode;
    lineHeight: LineHeight;
    fontFamily: FontFamily;
    contentFontSize: ContentFontSize;
    /**
     * 댓글 글씨 크기 (#9365). 'inherit' 이면 contentFontSize 를 따라가고,
     * 그 외 값이면 본문과 독립적으로 적용됩니다.
     */
    commentFontSize: ContentFontSize | 'inherit';
    hideMyProfile: boolean;
    // 게시판
    contentBlur: boolean;
    hidePostList: boolean;
    hideReadNotices: boolean;
    muteKeywords: string[];
    showNewComments: boolean;
    // 단축키
    enableKeyboardShortcuts: boolean;
    showShortcutBadge: boolean;
    showShortcutButtons: boolean;
    shortcutButtonSize: ShortcutButtonSize;
    // 터치 제스처
    enableTouchGestures: boolean;
    swipeThreshold: number;
    doubleTapInterval: number;
    // 글씨 크기
    listFontSize: ListFontSize;
    recommendFontSize: ListFontSize;
    // 검색
    pinSearch: boolean;
    pinMemoSearch: boolean;
    // 기타 (메모)
    hideMemo: boolean;
    hideMemoInList: boolean;
    blurMemo: boolean;
}

const DEFAULTS: UiSettings = {
    titleBold: false,
    listView: 'classic',
    lineHeight: 'normal',
    fontFamily: 'default',
    contentFontSize: 'base',
    commentFontSize: 'inherit',
    hideMyProfile: false,
    contentBlur: true,
    hidePostList: false,
    hideReadNotices: false,
    muteKeywords: [],
    showNewComments: true,
    enableKeyboardShortcuts: true,
    showShortcutBadge: true,
    showShortcutButtons: false,
    shortcutButtonSize: 'medium',
    listFontSize: 'base',
    recommendFontSize: 'base',
    pinSearch: false,
    pinMemoSearch: false,
    enableTouchGestures: false,
    swipeThreshold: 50,
    doubleTapInterval: 300,
    hideMemo: false,
    hideMemoInList: false,
    blurMemo: false
};

const LINE_HEIGHT_VALUES: Record<LineHeight, string> = {
    compact: '1.4',
    normal: '1.6',
    relaxed: '1.8',
    loose: '2.0'
};

const CONTENT_FONT_SIZES: Record<ContentFontSize, string> = {
    small: '14px',
    base: '16px',
    large: '18px',
    xlarge: '20px',
    '2xlarge': '22px',
    '3xlarge': '26px'
};

const FONT_FAMILY_VALUES: Record<FontFamily, string> = {
    default: '',
    pretendard:
        "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif",
    'nanum-gothic': "'NanumGothic', 'Nanum Gothic', sans-serif",
    'noto-sans': "'Noto Sans KR', sans-serif"
};

export const LIST_FONT_SIZES: Record<ListFontSize, string> = {
    xsmall: '13px',
    small: '14px',
    base: '16px',
    large: '18px',
    xlarge: '20px'
};

/** 본문 흐림 대상 키워드 (제목에 포함 시 블러 처리) */
export const BLUR_KEYWORDS = ['후방', '혐오', '혐짤', 'NSFW', 'nsfw', '스포일러'];
/** 단어 경계 매칭 키워드 (뒤에 한글 음절이 오면 매칭 제외 — "스포티파이" 등 false positive 방지) */
export const BLUR_KEYWORDS_BOUNDARY = ['스포'];

function loadSettings(): UiSettings {
    if (!browser) return { ...DEFAULTS };
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULTS, ...parsed };
        }
    } catch {
        // ignore
    }
    return { ...DEFAULTS };
}

/** 서버 write-through 디바운스 지연(ms) — 잦은 설정 변경을 1회 PUT으로 병합 */
const SERVER_SYNC_DEBOUNCE_MS = 1500;

function createUiSettingsStore() {
    let settings = $state<UiSettings>(loadSettings());

    // 서버 저장(L2) 디바운스 타이머. 로그인 여부는 엔드포인트가 판단하며,
    // 비로그인은 401 을 받아 조용히 무시된다(여기서 authStore 를 import 하지 않음 — 순환 회피).
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

    /** 현재 설정을 서버에 즉시 PUT(fire-and-forget). 비로그인 401 은 무시. */
    function syncToServer() {
        if (!browser) return;
        try {
            fetch('/api/my/ui-settings', {
                method: 'PUT',
                credentials: 'include',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ settings })
            }).catch(() => {
                // 네트워크/비로그인 실패는 무시 — L1(localStorage)이 원본 유지
            });
        } catch {
            // ignore
        }
    }

    /** save() 마다 호출되는 디바운스 서버 동기화(1.5s 병합). */
    function scheduleServerSync() {
        if (!browser) return;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = setTimeout(() => {
            syncTimer = null;
            syncToServer();
        }, SERVER_SYNC_DEBOUNCE_MS);
    }

    function save() {
        if (!browser) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch {
            // ignore
        }
        // 로그인 회원은 서버(L2)로 디바운스 write-through — save() 를 블록하지 않음
        scheduleServerSync();
    }

    function applyCSS() {
        if (!browser) return;
        const html = document.documentElement;

        html.style.setProperty('--content-line-height', LINE_HEIGHT_VALUES[settings.lineHeight]);

        html.style.setProperty('--list-font-size', LIST_FONT_SIZES[settings.listFontSize]);
        // #12365: 공감글/추천글 컴포넌트도 동일한 listFontSize 적용 — 사용자가
        // "리스트 글자 크기" 하나만 조정하면 모든 리스트류가 일관되게 변경됨.
        // recommendFontSize 설정 store key 는 backward-compat 위해 유지하되 미사용.
        html.style.setProperty('--recommend-font-size', LIST_FONT_SIZES[settings.listFontSize]);

        // 본문·에디터에 contentFontSize 연동
        html.style.setProperty('--content-font-size', CONTENT_FONT_SIZES[settings.contentFontSize]);
        html.style.setProperty('--editor-font-size', CONTENT_FONT_SIZES[settings.contentFontSize]);

        // 댓글 글씨 크기 (#9365): 'inherit' 이면 본문과 동일, 그 외엔 독립값
        const commentSize =
            settings.commentFontSize === 'inherit'
                ? CONTENT_FONT_SIZES[settings.contentFontSize]
                : CONTENT_FONT_SIZES[settings.commentFontSize];
        html.style.setProperty('--comment-font-size', commentSize);

        const fontVal = FONT_FAMILY_VALUES[settings.fontFamily];
        if (fontVal) {
            html.style.setProperty('--user-font-family', fontVal);
        } else {
            html.style.removeProperty('--user-font-family');
        }
    }

    if (browser) {
        applyCSS();
    }

    return {
        // 레이아웃
        get titleBold() {
            return settings.titleBold;
        },
        set titleBold(v: boolean) {
            settings.titleBold = v;
            save();
        },
        get listView() {
            return settings.listView;
        },
        set listView(v: ListViewMode) {
            settings.listView = v;
            save();
        },
        get lineHeight() {
            return settings.lineHeight;
        },
        get fontFamily() {
            return settings.fontFamily;
        },
        get contentFontSize() {
            return settings.contentFontSize;
        },
        setContentFontSize(v: ContentFontSize) {
            settings.contentFontSize = v;
            save();
            applyCSS();
        },
        /** A-/A/A+ 버튼용: -1=작게, 0=기본, 1=크게 */
        changeContentFontSize(direction: -1 | 0 | 1) {
            const order: ContentFontSize[] = [
                'small',
                'base',
                'large',
                'xlarge',
                '2xlarge',
                '3xlarge'
            ];
            if (direction === 0) {
                settings.contentFontSize = 'base';
            } else {
                const idx = order.indexOf(settings.contentFontSize);
                const next = idx + direction;
                if (next >= 0 && next < order.length) {
                    settings.contentFontSize = order[next];
                }
            }
            save();
            applyCSS();
        },
        get commentFontSize() {
            return settings.commentFontSize;
        },
        setCommentFontSize(v: ContentFontSize | 'inherit') {
            settings.commentFontSize = v;
            save();
            applyCSS();
        },
        get listFontSize() {
            return settings.listFontSize;
        },
        setListFontSize(v: ListFontSize) {
            settings.listFontSize = v;
            save();
            applyCSS();
        },
        get recommendFontSize() {
            return settings.recommendFontSize;
        },
        setRecommendFontSize(v: ListFontSize) {
            settings.recommendFontSize = v;
            save();
            applyCSS();
        },
        get hideMyProfile() {
            return settings.hideMyProfile;
        },
        // 게시판
        get contentBlur() {
            return settings.contentBlur;
        },
        get hidePostList() {
            return settings.hidePostList;
        },
        get hideReadNotices() {
            return settings.hideReadNotices;
        },
        setHideReadNotices(v: boolean) {
            settings.hideReadNotices = v;
            save();
        },
        get muteKeywords() {
            return settings.muteKeywords;
        },
        get showNewComments() {
            return settings.showNewComments;
        },
        setShowNewComments(v: boolean) {
            settings.showNewComments = v;
            save();
        },
        // 검색
        get pinSearch() {
            return settings.pinSearch;
        },
        setPinSearch(v: boolean) {
            settings.pinSearch = v;
            save();
        },
        get pinMemoSearch() {
            return settings.pinMemoSearch;
        },
        setPinMemoSearch(v: boolean) {
            settings.pinMemoSearch = v;
            save();
        },
        // 단축키
        get enableKeyboardShortcuts() {
            return settings.enableKeyboardShortcuts;
        },
        setEnableKeyboardShortcuts(v: boolean) {
            settings.enableKeyboardShortcuts = v;
            save();
        },
        get showShortcutBadge() {
            return settings.showShortcutBadge;
        },
        setShowShortcutBadge(v: boolean) {
            settings.showShortcutBadge = v;
            save();
        },
        get showShortcutButtons() {
            return settings.showShortcutButtons;
        },
        setShowShortcutButtons(v: boolean) {
            settings.showShortcutButtons = v;
            save();
        },
        get shortcutButtonSize() {
            return settings.shortcutButtonSize;
        },
        setShortcutButtonSize(v: ShortcutButtonSize) {
            settings.shortcutButtonSize = v;
            save();
        },
        // 터치 제스처
        get enableTouchGestures() {
            return settings.enableTouchGestures;
        },
        setEnableTouchGestures(v: boolean) {
            settings.enableTouchGestures = v;
            save();
        },
        get swipeThreshold() {
            return settings.swipeThreshold;
        },
        setSwipeThreshold(v: number) {
            settings.swipeThreshold = v;
            save();
        },
        get doubleTapInterval() {
            return settings.doubleTapInterval;
        },
        setDoubleTapInterval(v: number) {
            settings.doubleTapInterval = v;
            save();
        },
        // 메모
        get hideMemo() {
            return settings.hideMemo;
        },
        get hideMemoInList() {
            return settings.hideMemoInList;
        },
        get blurMemo() {
            return settings.blurMemo;
        },

        setTitleBold(v: boolean) {
            settings.titleBold = v;
            save();
        },
        setLineHeight(v: LineHeight) {
            settings.lineHeight = v;
            save();
            applyCSS();
        },
        setFontFamily(v: FontFamily) {
            settings.fontFamily = v;
            save();
            applyCSS();
        },
        setHideMyProfile(v: boolean) {
            settings.hideMyProfile = v;
            save();
        },
        setContentBlur(v: boolean) {
            settings.contentBlur = v;
            save();
        },
        setHidePostList(v: boolean) {
            settings.hidePostList = v;
            save();
        },
        setMuteKeywords(v: string[]) {
            settings.muteKeywords = v;
            save();
        },
        addMuteKeyword(keyword: string) {
            const trimmed = keyword.trim();
            if (trimmed && !settings.muteKeywords.includes(trimmed)) {
                settings.muteKeywords = [...settings.muteKeywords, trimmed];
                save();
            }
        },
        removeMuteKeyword(keyword: string) {
            settings.muteKeywords = settings.muteKeywords.filter((k) => k !== keyword);
            save();
        },
        setHideMemo(v: boolean) {
            settings.hideMemo = v;
            save();
        },
        setHideMemoInList(v: boolean) {
            settings.hideMemoInList = v;
            save();
        },
        setBlurMemo(v: boolean) {
            settings.blurMemo = v;
            save();
        },

        /**
         * 서버(L2) 설정을 로컬에 병합. 로그인 회원은 서버가 진실 원본이므로
         * 서버 값이 우선한다(server wins). 병합 후 localStorage 에도 반영.
         * null/비객체면 no-op(서버에 저장값 없음 = 첫 도입).
         */
        mergeServerSettings(server: Partial<UiSettings> | null): void {
            if (!browser) return;
            if (!server || typeof server !== 'object') return;
            settings = { ...settings, ...server };
            save();
            applyCSS();
        },

        /** 현재 로컬 설정을 서버에 즉시 올림(첫 로그인 마이그레이션용). */
        syncToServer,

        /** 제목이 뮤트 키워드에 매칭되는지 확인 */
        isMuted(title: string): boolean {
            if (settings.muteKeywords.length === 0) return false;
            const lower = title.toLowerCase();
            return settings.muteKeywords.some((k) => lower.includes(k.toLowerCase()));
        },

        /** 제목에 블러 키워드가 포함되어 본문을 흐림 처리해야 하는지 */
        shouldBlurContent(title: string): boolean {
            if (!settings.contentBlur) return false;
            const lower = title.toLowerCase();
            // 일반 키워드: 포함 매칭
            if (BLUR_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return true;
            // 경계 매칭 키워드: 뒤에 한글 음절(가-힣)이 오면 단어 일부이므로 제외
            return BLUR_KEYWORDS_BOUNDARY.some((k) => {
                const kLower = k.toLowerCase();
                const idx = lower.indexOf(kLower);
                if (idx === -1) return false;
                const after = lower[idx + kLower.length];
                if (after && after >= '\uAC00' && after <= '\uD7A3') return false;
                return true;
            });
        }
    };
}

export const uiSettingsStore = createUiSettingsStore();
