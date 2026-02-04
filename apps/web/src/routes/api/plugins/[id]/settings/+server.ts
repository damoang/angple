/**
 * 플러그인 설정 조회/수정 API
 *
 * GET /api/plugins/[id]/settings - 플러그인 설정 조회
 * PUT /api/plugins/[id]/settings - 플러그인 설정 수정
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPluginById, updatePluginSettings, isPluginInstalled } from '$lib/server/plugins';

/**
 * GET /api/plugins/[id]/settings
 * 특정 플러그인 설정 조회
 */
export const GET: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;

        if (!id) {
            throw error(400, '플러그인 ID가 필요합니다.');
        }

        const plugin = await getPluginById(id);

        if (!plugin) {
            throw error(404, `플러그인을 찾을 수 없습니다: ${id}`);
        }

        return json({
            pluginId: id,
            settings: plugin.currentSettings || {},
            schema: plugin.manifest.settings || {}
        });
    } catch (err) {
        console.error('❌ [API /plugins/[id]/settings] 설정 조회 실패:', err);

        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }

        throw error(500, '플러그인 설정 조회 중 오류가 발생했습니다.');
    }
};

/**
 * PUT /api/plugins/[id]/settings
 * 특정 플러그인 설정 수정
 */
export const PUT: RequestHandler = async ({ params, request }) => {
    try {
        const { id } = params;

        if (!id) {
            throw error(400, '플러그인 ID가 필요합니다.');
        }

        if (!isPluginInstalled(id)) {
            throw error(404, `플러그인을 찾을 수 없습니다: ${id}`);
        }

        const body = await request.json();
        const { settings } = body as { settings: Record<string, unknown> };

        if (!settings || typeof settings !== 'object') {
            throw error(400, 'settings 객체가 필요합니다.');
        }

        // 설정 업데이트
        const success = await updatePluginSettings(id, settings);

        if (!success) {
            throw error(500, '플러그인 설정 저장에 실패했습니다.');
        }

        console.log(`✅ [API /plugins/[id]/settings] 설정 업데이트: ${id}`);

        return json({
            success: true,
            pluginId: id,
            settings
        });
    } catch (err) {
        console.error('❌ [API /plugins/[id]/settings] 설정 수정 실패:', err);

        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }

        throw error(500, '플러그인 설정 수정 중 오류가 발생했습니다.');
    }
};
