/**
 * 위젯 목록 API
 *
 * GET /api/widgets
 * - 설치된 모든 위젯 목록 반환
 * - 공식/커스텀 구분 포함
 * - 관리자 전용
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scanWidgets } from '$lib/server/widgets';

/**
 * GET /api/widgets
 *
 * 설치된 위젯 목록 조회
 */
export const GET: RequestHandler = async ({ locals }) => {
    if (!locals.user) {
        return json({ success: false, error: '인증이 필요합니다.' }, { status: 401 });
    }
    if ((locals.user.level ?? 0) < 10) {
        return json({ success: false, error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    try {
        const widgetsMap = scanWidgets();
        const widgets = Array.from(widgetsMap.values());

        // 카테고리별로 정렬
        widgets.sort((a, b) => {
            // 먼저 카테고리별
            if (a.category !== b.category) {
                return a.category.localeCompare(b.category);
            }
            // 그 다음 이름별
            return a.name.localeCompare(b.name);
        });

        return json({
            success: true,
            widgets,
            count: {
                total: widgets.length,
                official: widgets.filter((w) => !w.isCustom).length,
                custom: widgets.filter((w) => w.isCustom).length
            }
        });
    } catch (error) {
        console.error('❌ [Widget API] 위젯 목록 조회 실패:', error);
        return json(
            {
                success: false,
                error: '위젯 목록을 불러오는데 실패했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
