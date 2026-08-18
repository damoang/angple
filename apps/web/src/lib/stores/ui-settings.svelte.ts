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
    /**
     * 읽은 공지를 접어 두고 개수만 표시한다(펼치기 가능).
     *
     * ⛔ `hideReadNotices`(완전 숨김)와 다른 항목이다. 둘 다 켜지면 숨김이 이긴다 —
     *    안 보이기로 한 것을 접기가 되살리면 설정을 무시하는 셈이 된다.
     */
    collapseReadNotices: boolean;
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
    /**
     * 차단한 회원의 댓글을 안내문 없이 아예 표시하지 않음 (#13224).
     * ⛔ 기본값은 false 다. 켜는 사람만 켠다 — 차단이 기본으로 강해지면 새로 온 회원이
     *    자기 글에 왜 반응이 없는지 모른 채 겉돌게 된다. 그 비용을 전원에게 물리지 않는다.
     * 답글이 달린 댓글은 이 설정과 무관하게 안내문을 남긴다(제3자 답글 보호).
     */
    hideBlockedComments: boolean;
    // 기타 (메모)
    hideMemo: boolean;
    hideMemoInList: boolean;
    blurMemo: boolean;
    /** 목록에서 메모 배지를 넓게(반응형) 표시 (기본 true) */
    expandMemoInList: boolean;
    /** 메모 색상별 사용자 지정 이름표 (color→label). 빈 값은 기본 이름 사용 (#13013) */
    memoColorLabels: Record<string, string>;
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
    // 기본 켜짐 — 고정 공지가 여러 개인 게시판에서 읽은 공지가 목록 최상단을 계속
    // 차지하는 것이 본래 문제였다. 개수는 알려주고 언제든 펼칠 수 있으므로 정보 손실이 없다.
    collapseReadNotices: true,
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
    hideBlockedComments: false,
    hideMemo: false,
    hideMemoInList: false,
    blurMemo: false,
    expandMemoInList: true,
    memoColorLabels: {}
};

// ⛔ normal 은 현재 라이브 하드코딩(markdown .prose p / tiptap p = 1.8)과 **같은 값**이어야 한다.
//    #13456: 이 설정은 그동안 --content-line-height 를 읽는 CSS 가 0곳이라 죽어 있었다.
//    이제 markdown/에디터가 var(--content-line-height, 1.8) 로 소비하는데, 만약 기본값을
//    1.6 으로 두면 설정을 한 번도 안 만진 전 사용자의 본문이 1.8→1.6 으로 좁아지는 대량
//    회귀가 난다. 그래서 normal=1.8 로 고정하고 나머지만 의미 있게 벌린다.
const LINE_HEIGHT_VALUES: Record<LineHeight, string> = {
    compact: '1.5',
    normal: '1.8',
    relaxed: '2.0',
    loose: '2.3'
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

/**
 * 이미지 지시성 블러 키워드 (제목에 포함 시 본문 블러 처리).
 * '혐오'는 담론성 표현('혐오 문화/표현/범죄' 등) 오탐이 심해 bare 매칭을 제거하고,
 * 이미지 지시 변형('혐짤/혐오짤/혐오사진/혐오 사진/혐오 이미지')만 대상으로 한다.
 */
export const BLUR_KEYWORDS = [
    '후방',
    '혐짤',
    '혐오짤',
    '혐오사진',
    '혐오 사진',
    '혐오 이미지',
    'NSFW',
    'nsfw'
];
/** 스포일러 계열 키워드 (부정/관용 표현 화이트리스트에 걸리지 않을 때만 블러) */
export const BLUR_SPOILER_KEYWORDS = ['스포일러', '스포'];
/**
 * 스포일러 계열 오탐 방지 화이트리스트.
 * 제목에 이 중 하나라도 포함되면 스포일러 계열 블러를 적용하지 않는다.
 * ('노스포 후기', '스포주의', '스포 없음' 등 부정/주의 관용 표현)
 */
export const BLUR_SPOILER_WHITELIST = [
    '노스포',
    '무스포',
    '스포주의',
    '스포 주의',
    '스포방지',
    '스포 방지',
    '스포 없',
    '스포없',
    '스포x'
];

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
        get collapseReadNotices() {
            return settings.collapseReadNotices;
        },
        setCollapseReadNotices(v: boolean) {
            settings.collapseReadNotices = v;
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
        get hideBlockedComments() {
            return settings.hideBlockedComments;
        },
        get hideMemo() {
            return settings.hideMemo;
        },
        get hideMemoInList() {
            return settings.hideMemoInList;
        },
        get blurMemo() {
            return settings.blurMemo;
        },
        get expandMemoInList() {
            return settings.expandMemoInList;
        },
        get memoColorLabels() {
            return settings.memoColorLabels;
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
        setHideBlockedComments(v: boolean) {
            settings.hideBlockedComments = v;
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
        setExpandMemoInList(v: boolean) {
            settings.expandMemoInList = v;
            save();
        },
        /** 색상 이름표 설정. 빈 문자열이면 해당 색상 라벨 제거(기본 이름 사용). */
        setMemoColorLabel(color: string, label: string) {
            const trimmed = label.trim().slice(0, 10);
            const next = { ...settings.memoColorLabels };
            if (trimmed) next[color] = trimmed;
            else delete next[color];
            settings.memoColorLabels = next;
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
            // 이미지 지시성 키워드: 포함 매칭
            if (BLUR_KEYWORDS.some((k) => lower.includes(k.toLowerCase()))) return true;
            // 스포일러 계열: 부정/관용 표현(노스포·스포주의 등)이 있으면 블러 제외
            if (BLUR_SPOILER_WHITELIST.some((w) => lower.includes(w.toLowerCase()))) return false;
            return BLUR_SPOILER_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
        }
    };
}

export const uiSettingsStore = createUiSettingsStore();
