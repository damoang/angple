/**
 * 위젯 레이아웃 API
 *
 * GET /api/layout - 현재 레이아웃 조회
 * PUT /api/layout - 레이아웃 저장
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readSettings, writeSettings, type WidgetConfig } from '$lib/server/settings';

// 기본 메인 위젯 레이아웃
const DEFAULT_WIDGETS: WidgetConfig[] = [
    { id: 'ad-head', type: 'ad', position: 0, enabled: true, settings: { position: 'index-head' } },
    { id: 'recommended', type: 'recommended', position: 1, enabled: true },
    { id: 'ad-top', type: 'ad', position: 2, enabled: true, settings: { position: 'index-top' } },
    {
        id: 'news-economy-row',
        type: 'news-economy-row',
        position: 3,
        enabled: true
    },
    {
        id: 'ad-middle-1',
        type: 'ad',
        position: 4,
        enabled: true,
        settings: { position: 'index-middle-1' }
    },
    { id: 'gallery', type: 'gallery', position: 5, enabled: true },
    {
        id: 'ad-middle-2',
        type: 'ad',
        position: 6,
        enabled: true,
        settings: { position: 'index-middle-2' }
    },
    { id: 'group', type: 'group', position: 7, enabled: true },
    {
        id: 'ad-bottom',
        type: 'ad',
        position: 8,
        enabled: true,
        settings: { position: 'index-bottom' }
    }
];

// 기본 사이드바 위젯 레이아웃
const DEFAULT_SIDEBAR_WIDGETS: WidgetConfig[] = [
    { id: 'notice', type: 'notice', position: 0, enabled: true },
    { id: 'podcast', type: 'podcast', position: 1, enabled: true },
    {
        id: 'sidebar-ad-1',
        type: 'sidebar-ad',
        position: 2,
        enabled: true,
        settings: { type: 'image', format: 'square' }
    },
    {
        id: 'sidebar-ad-2',
        type: 'sidebar-ad',
        position: 3,
        enabled: true,
        settings: { type: 'image-text', format: 'grid' }
    },
    { id: 'sharing-board', type: 'sharing-board', position: 4, enabled: true },
    { id: 'sticky-ads', type: 'sticky-ads', position: 5, enabled: true }
];

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
        // 인증 확인 (damoang_jwt 쿠키)
        const token = cookies.get('damoang_jwt');
        if (!token) {
            return json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        // 사용자 레벨 확인 (백엔드에서 검증)
        // TODO: 백엔드 API를 통해 사용자 레벨 확인
        // 현재는 토큰이 있으면 관리자로 간주 (실제 운영 시 개선 필요)

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
        console.error('❌ 레이아웃 저장 실패:', error);
        return json({ error: '레이아웃 저장에 실패했습니다.' }, { status: 500 });
    }
};
