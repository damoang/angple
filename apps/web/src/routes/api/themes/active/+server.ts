/**
 * 활성 테마 API
 * - GET: 현재 활성화된 테마 조회
 * - PUT: 테마 활성화
 *
 * Provider 기반 (MySQL+Redis 또는 JSON)
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActiveTheme, setActiveTheme, getAllSettings } from '$lib/server/settings/index';
import { sanitizePath } from '$lib/server/path-utils';

/**
 * 이 공개 API 가 내보내도 되는 설정 키 (allowlist).
 * ⛔ 새 키를 추가할 때는 "익명에게 보여도 되는가"를 먼저 판단할 것.
 *    angple_settings 는 테마 외 설정도 담는 공용 테이블이다.
 */
const THEME_PUBLIC_KEY =
    /^(active_theme|theme_settings_|theme_activated_at|widget_layout|sidebar_widget_layout)/;

/**
 * GET /api/themes/active
 * 현재 활성화된 테마 정보 반환
 */
export const GET: RequestHandler = async () => {
    try {
        const activeTheme = await getActiveTheme();

        if (!activeTheme) {
            return json({ error: '활성화된 테마가 없습니다.' }, { status: 404 });
        }

        // ⛔ getAllSettings() 는 angple_settings **전 행**을 돌려준다. 이 엔드포인트는
        //    인증 가드가 없는 공개 API 이므로 테마 관련 키만 골라 내보낸다.
        //    (그대로 펼치면 같은 테이블에 들어오는 사이트 설정의 OAuth client secret 이나
        //     플러그인 설정의 API 키가 익명에게 노출된다 — 2026-07-31 실측으로 확인)
        const settings = await getAllSettings();
        const publicSettings: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(settings)) {
            if (THEME_PUBLIC_KEY.test(key)) publicSettings[key] = value;
        }
        return json({ activeTheme, ...publicSettings });
    } catch (error) {
        console.error('❌ 활성 테마 조회 실패:', error);
        return json({ error: '서버 오류' }, { status: 500 });
    }
};

/**
 * PUT /api/themes/active
 * 테마 활성화
 */
export const PUT: RequestHandler = async ({ request }) => {
    try {
        const { themeId } = await request.json();

        if (!themeId || typeof themeId !== 'string') {
            return json({ error: 'themeId가 필요합니다.' }, { status: 400 });
        }

        // Path Traversal 방지
        const sanitizedThemeId = sanitizePath(themeId);

        await setActiveTheme(sanitizedThemeId);

        return json({ success: true, themeId: sanitizedThemeId });
    } catch (error) {
        console.error('❌ 테마 활성화 실패:', error);

        // sanitizePath 에러는 400으로 처리
        if (error instanceof Error && error.message.includes('Invalid path')) {
            return json({ error: error.message }, { status: 400 });
        }

        return json({ error: '서버 오류' }, { status: 500 });
    }
};
