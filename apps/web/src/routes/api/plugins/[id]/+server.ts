/**
 * 개별 플러그인 조회/삭제 API
 *
 * GET /api/plugins/[id] - 특정 플러그인 정보 조회
 * DELETE /api/plugins/[id] - 커스텀 플러그인 삭제 (공식 플러그인은 삭제 불가)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPluginById, isCustomPlugin, deactivatePlugin } from '$lib/server/plugins';
import { rm } from 'fs/promises';
import { join, resolve } from 'path';

/**
 * GET /api/plugins/[id]
 * 특정 플러그인 정보 조회
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
            plugin: {
                manifest: plugin.manifest,
                status: plugin.isActive ? 'active' : 'inactive',
                currentSettings: plugin.currentSettings,
                source: plugin.source
            }
        });
    } catch (err) {
        console.error('❌ [API /plugins/[id]] 플러그인 조회 실패:', err);

        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }

        throw error(500, '플러그인 조회 중 오류가 발생했습니다.');
    }
};

/**
 * DELETE /api/plugins/[id]
 * 커스텀 플러그인 삭제 (공식 플러그인은 삭제 불가)
 */
export const DELETE: RequestHandler = async ({ params }) => {
    try {
        const { id } = params;

        if (!id) {
            throw error(400, '플러그인 ID가 필요합니다.');
        }

        const plugin = await getPluginById(id);

        if (!plugin) {
            throw error(404, `플러그인을 찾을 수 없습니다: ${id}`);
        }

        // 공식 플러그인은 삭제 불가
        if (!isCustomPlugin(id)) {
            throw error(403, '공식 플러그인은 삭제할 수 없습니다.');
        }

        // 플러그인이 활성화되어 있으면 먼저 비활성화
        if (plugin.isActive) {
            await deactivatePlugin(id);
        }

        // 플러그인 디렉터리 삭제
        const pluginPath = plugin.path;

        // 경로가 custom-plugins 디렉터리 내에 있는지 확인 (보안)
        const cwd = process.cwd();
        let projectRoot = cwd;
        if (cwd.includes('apps/web')) {
            projectRoot = resolve(cwd, '../..');
        } else if (cwd.includes('apps/admin')) {
            projectRoot = resolve(cwd, '../..');
        }
        const customPluginsDir = join(projectRoot, 'custom-plugins');

        if (!pluginPath.startsWith(customPluginsDir)) {
            throw error(403, '잘못된 플러그인 경로입니다.');
        }

        await rm(pluginPath, { recursive: true, force: true });

        console.log(`✅ [API /plugins/[id]] 플러그인 삭제됨: ${id}`);

        return json({
            success: true,
            message: `플러그인이 삭제되었습니다: ${id}`
        });
    } catch (err) {
        console.error('❌ [API /plugins/[id]] 플러그인 삭제 실패:', err);

        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }

        throw error(500, '플러그인 삭제 중 오류가 발생했습니다.');
    }
};
