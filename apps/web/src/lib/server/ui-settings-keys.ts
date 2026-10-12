/**
 * PUT /api/my/ui-settings 의 키 화이트리스트(라우트 파일은 임의 export 를 할 수 없어 분리).
 */

/**
 * 허용된 UiSettings 최상위 키 화이트리스트.
 * stores/ui-settings.svelte.ts 의 UiSettings 인터페이스와 동일하게 유지한다.
 * 알 수 없는 키는 오류 대신 드롭(forward-compatible).
 */
export const UI_SETTINGS_ALLOWED_KEYS: ReadonlySet<string> = new Set<string>([
    'titleBold',
    'listView',
    'lineHeight',
    'fontFamily',
    'contentFontSize',
    'commentFontSize',
    'hideMyProfile',
    'contentBlur',
    'hidePostList',
    'hideReadNotices',
    'collapseReadNotices',
    'muteKeywords',
    'showNewComments',
    'enableKeyboardShortcuts',
    'showShortcutBadge',
    'showShortcutButtons',
    'shortcutButtonSize',
    'enableTouchGestures',
    'swipeThreshold',
    'doubleTapInterval',
    'listFontSize',
    'recommendFontSize',
    'pinSearch',
    'pinMemoSearch',
    'hideBlockedComments',
    'hideMemo',
    'hideMemoInList',
    'blurMemo',
    'expandMemoInList',
    'memoColorLabels',
    'messageDeny'
]);
