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
export type ListFontSize = 'small' | 'base' | 'large' | 'xlarge';

interface UiSettings {
    // 레이아웃
    titleBold: boolean;
    listView: ListViewMode;
    lineHeight: LineHeight;
    fontFamily: FontFamily;
    contentFontSize: ContentFontSize;
    hideMyProfile: boolean;
    // 게시판
    contentBlur: boolean;
    hidePostList: boolean;
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
    hideMyProfile: false,
    contentBlur: true,
    hidePostList: false,
    muteKeywords: [],
    showNewComments: true,
    enableKeyboardShortcuts: true,
    showShortcutBadge: true,
    showShortcutButtons: false,
    shortcutButtonSize: 'medium',
    listFontSize: 'base',
    recommendFontSize: 'base',
    pinSearch: false,
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

const FONT_FAMILY_VALUES: Record<FontFamily, string> = {
    default: '',
    pretendard:
        "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif",
    'nanum-gothic': "'NanumGothic', 'Nanum Gothic', sans-serif",
    'noto-sans': "'Noto Sans KR', sans-serif"
};

export const LIST_FONT_SIZES: Record<ListFontSize, string> = {
    small: '13px',
    base: '15px',
    large: '17px',
    xlarge: '19px'
};

/** 본문 흐림 대상 키워드 (제목에 포함 시 블러 처리) */
export const BLUR_KEYWORDS = ['후방', '스포', '혐오', '혐짤', 'NSFW', 'nsfw', '스포일러'];

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

function createUiSettingsStore() {
    let settings = $state<UiSettings>(loadSettings());

    function save() {
        if (!browser) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch {
            // ignore
        }
    }

    function applyCSS() {
        if (!browser) return;
        const html = document.documentElement;

        html.style.setProperty('--content-line-height', LINE_HEIGHT_VALUES[settings.lineHeight]);

        html.style.setProperty('--list-font-size', LIST_FONT_SIZES[settings.listFontSize]);
        html.style.setProperty(
            '--recommend-font-size',
            LIST_FONT_SIZES[settings.recommendFontSize]
        );

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
            return BLUR_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
        }
    };
}

export const uiSettingsStore = createUiSettingsStore();
