/**
 * UI 개인화 설정 기본값 — ui-settings.svelte.ts 스토어가 쓰는 정본.
 *
 * 런타임 의존성 없는 순수 모듈로 분리해 서버 화이트리스트(ui-settings-keys.ts)와의
 * 키 일치를 테스트로 검사할 수 있게 한다.
 */
import type { UiSettings } from './ui-settings.svelte';

export const UI_SETTINGS_DEFAULTS: UiSettings = {
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
    memoColorLabels: {},
    messageDeny: false
};
