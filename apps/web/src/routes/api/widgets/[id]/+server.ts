/**
 * 위젯 삭제 API
 *
 * DELETE /api/widgets/:id
 * - 커스텀 위젯만 삭제 가능
 * - 공식 위젯은 삭제 불가
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { sanitizePath } from '$lib/server/path-utils';
import {
    isCustomWidget,
    getWidgetManifest,
    scanWidgets,
    getCustomWidgetsDir
} from '$lib/server/widgets';

/** 커스텀 위젯 디렉터리 */
const CUSTOM_WIDGETS_DIR = getCustomWidgetsDir();

/**
 * GET /api/widgets/:id
 *
 * 특정 위젯 정보 조회
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const widgetId = sanitizePath(params.id);
        const manifest = getWidgetManifest(widgetId);

        if (!manifest) {
            return json({ success: false, error: '위젯을 찾을 수 없습니다.' }, { status: 404 });
        }

        return json({
            success: true,
            widget: {
                ...manifest,
                isCustom: isCustomWidget(widgetId)
            }
        });
    } catch (error) {
        console.error('[Widget API] 위젯 조회 실패:', error);
        return json(
            {
                success: false,
                error: '위젯 정보를 불러오는데 실패했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};

/**
 * DELETE /api/widgets/:id
 *
 * 위젯 삭제 (커스텀 위젯만)
 */
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const widgetId = sanitizePath(params.id);

        // 위젯 존재 여부 확인
        const manifest = getWidgetManifest(widgetId);
        if (!manifest) {
            return json({ success: false, error: '위젯을 찾을 수 없습니다.' }, { status: 404 });
        }

        // 커스텀 위젯인지 확인
        if (!isCustomWidget(widgetId)) {
            return json(
                { success: false, error: '공식 위젯은 삭제할 수 없습니다.' },
                { status: 403 }
            );
        }

        // 위젯 디렉터리 삭제
        const widgetDir = join(CUSTOM_WIDGETS_DIR, widgetId);
        if (existsSync(widgetDir)) {
            rmSync(widgetDir, { recursive: true, force: true });
        }

        // 위젯 재스캔
        scanWidgets();

        return json({
            success: true,
            message: `위젯 "${manifest.name}"가 삭제되었습니다.`,
            widgetId
        });
    } catch (error) {
        console.error('[Widget API] 위젯 삭제 실패:', error);
        return json(
            {
                success: false,
                error: '위젯 삭제 중 오류가 발생했습니다.',
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
};
