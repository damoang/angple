/**
 * 회원 UI 개인화 설정 API (#12891)
 *
 * localStorage(L1) 전용 저장의 취약성을 보완하기 위한 서버 저장(L2) 엔드포인트.
 * - GET: 로그인 회원의 서버 저장 설정을 반환(없으면 settings=null).
 * - PUT: 클라이언트의 UiSettings 전체 blob 을 검증·상한 후 upsert(디바운스 write-through).
 *
 * per-user 응답이므로 `private, no-store`(공유 캐시 누출 방지). 내부 앱 전용.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUser } from '$lib/server/auth';
import { internalOnlyErrorResponse, isInternalAppRequest } from '$lib/server/internal-api.js';
import { getMemberUiSettings, putMemberUiSettings } from '$lib/server/ui-settings-store';

/**
 * 허용된 UiSettings 최상위 키 화이트리스트.
 * stores/ui-settings.svelte.ts 의 UiSettings 인터페이스와 동일하게 유지한다.
 * 알 수 없는 키는 오류 대신 드롭(forward-compatible).
 */
const ALLOWED_KEYS = new Set<string>([
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
    'hideMemo',
    'hideMemoInList',
    'blurMemo',
    'expandMemoInList'
]);

/** 남용 방어 상한 */
const MAX_JSON_BYTES = 16384;
const MAX_MUTE_KEYWORDS = 200;
const MAX_MUTE_KEYWORD_LEN = 50;

export const GET: RequestHandler = async ({ cookies, request, setHeaders }) => {
    if (!isInternalAppRequest(request)) {
        return internalOnlyErrorResponse();
    }

    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    setHeaders({ 'Cache-Control': 'private, no-store' });

    // 장애 시 getMemberUiSettings 는 null 반환(throw 안 함) → 클라는 L1 유지
    const settings = await getMemberUiSettings(user.mb_id);
    return json({ success: true, settings });
};

export const PUT: RequestHandler = async ({ cookies, request, setHeaders }) => {
    if (!isInternalAppRequest(request)) {
        return internalOnlyErrorResponse();
    }

    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
    }

    setHeaders({ 'Cache-Control': 'private, no-store' });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, message: '잘못된 요청 본문입니다.' }, { status: 400 });
    }

    const settings = (body as { settings?: unknown } | null)?.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        return json({ success: false, message: 'settings 객체가 필요합니다.' }, { status: 400 });
    }

    const raw = settings as Record<string, unknown>;

    // 전체 크기 상한
    if (JSON.stringify(raw).length > MAX_JSON_BYTES) {
        return json({ success: false, message: '설정 크기가 너무 큽니다.' }, { status: 400 });
    }

    // muteKeywords 상한/형식 검증
    if ('muteKeywords' in raw && raw.muteKeywords !== undefined) {
        const mk = raw.muteKeywords;
        if (!Array.isArray(mk)) {
            return json(
                { success: false, message: 'muteKeywords 형식이 올바르지 않습니다.' },
                { status: 400 }
            );
        }
        if (mk.length > MAX_MUTE_KEYWORDS) {
            return json(
                { success: false, message: '뮤트 키워드가 너무 많습니다.' },
                { status: 400 }
            );
        }
        for (const item of mk) {
            if (typeof item !== 'string' || item.length > MAX_MUTE_KEYWORD_LEN) {
                return json(
                    { success: false, message: '뮤트 키워드 형식/길이가 올바르지 않습니다.' },
                    { status: 400 }
                );
            }
        }
    }

    // 화이트리스트: 알려진 키만 통과, 알 수 없는 키는 드롭(forward-compatible)
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
        if (ALLOWED_KEYS.has(k)) cleaned[k] = v;
    }

    const ok = await putMemberUiSettings(user.mb_id, cleaned);
    if (!ok) {
        // 저장 실패해도 예외는 아님 — 클라는 L1(localStorage)로 계속 동작
        return json({ success: false, message: '저장에 실패했습니다.' }, { status: 500 });
    }
    return json({ success: true });
};
