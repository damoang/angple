/**
 * 위젯 레이아웃 API
 *
 * GET /api/layout - 현재 레이아웃 조회
 * PUT /api/layout - 레이아웃 저장
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readSettings, writeSettings } from '$lib/server/settings';
import { DEFAULT_WIDGETS, DEFAULT_SIDEBAR_WIDGETS } from '$lib/constants/default-widgets';

/**
 * 레이아웃 조회
 */
export const GET: RequestHandler = async () => {
    try {
        const settings = await readSettings();
        const widgets = settings.widgetLayout;
        const sidebarWidgets = settings.sidebarWidgetLayout;

        return json({
            widgets: widgets ?? DEFAULT_WIDGETS,
            sidebarWidgets: sidebarWidgets ?? DEFAULT_SIDEBAR_WIDGETS
        });
    } catch (error) {
        console.error('❌ 레이아웃 조회 실패:', error);
        return json({
            widgets: DEFAULT_WIDGETS,
            sidebarWidgets: DEFAULT_SIDEBAR_WIDGETS
        });
    }
};

/**
 * 레이아웃 저장
 */
export const PUT: RequestHandler = async ({ request, cookies }) => {
    try {
        // 인증 확인
        // TODO: 운영 환경에서는 백엔드 API를 통한 관리자 권한 검증 필요
        const isDev = process.env.NODE_ENV === 'development' || import.meta.env.DEV;
        const legacyCookie = import.meta.env.VITE_LEGACY_SSO_COOKIE || '';
        const token = legacyCookie ? cookies.get(legacyCookie) : cookies.get('refresh_token');
        if (!isDev && !token) {
            return json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { widgets, sidebarWidgets } = await request.json();

        // 메인 위젯 유효성 검증
        if (widgets !== undefined) {
            if (!Array.isArray(widgets)) {
                return json({ error: '잘못된 메인 위젯 형식입니다.' }, { status: 400 });
            }
            for (const widget of widgets) {
                if (!widget.id || !widget.type || typeof widget.position !== 'number') {
                    return json({ error: '잘못된 메인 위젯 데이터입니다.' }, { status: 400 });
                }
            }
        }

        // 사이드바 위젯 유효성 검증
        if (sidebarWidgets !== undefined) {
            if (!Array.isArray(sidebarWidgets)) {
                return json({ error: '잘못된 사이드바 위젯 형식입니다.' }, { status: 400 });
            }
            for (const widget of sidebarWidgets) {
                if (!widget.id || !widget.type || typeof widget.position !== 'number') {
                    return json({ error: '잘못된 사이드바 위젯 데이터입니다.' }, { status: 400 });
                }
            }
        }

        // 설정 저장
        const settings = await readSettings();
        if (widgets !== undefined) {
            settings.widgetLayout = widgets;
        }
        if (sidebarWidgets !== undefined) {
            settings.sidebarWidgetLayout = sidebarWidgets;
        }
        await writeSettings(settings);

        console.log('✅ 레이아웃 저장 완료');

        return json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('❌ 레이아웃 저장 실패:', message, error);
        return json({ error: `레이아웃 저장에 실패했습니다: ${message}` }, { status: 500 });
    }
};
