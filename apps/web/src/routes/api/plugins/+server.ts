/**
 * 플러그인 목록 조회 및 활성화/비활성화 API
 *
 * GET /api/plugins - 파일 시스템에서 스캔한 실제 플러그인 목록을 반환합니다.
 * POST /api/plugins - 플러그인 활성화/비활성화를 처리합니다.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getInstalledPlugins,
    activatePlugin,
    deactivatePlugin
} from '$lib/server/plugins';
import type { PluginManifest } from '$lib/types/plugin';

/**
 * PluginWithStatus 타입 (Admin과 호환)
 */
interface PluginWithStatus {
    /** 플러그인 매니페스트 */
    manifest: PluginManifest;

    /** 현재 상태 */
    status: 'active' | 'inactive' | 'installing' | 'error';

    /** 설치 날짜 */
    installedAt: Date;

    /** 마지막 업데이트 날짜 */
    updatedAt?: Date;

    /** 활성화 날짜 (활성화된 경우) */
    activatedAt?: Date;

    /** 현재 적용된 설정값 */
    currentSettings?: Record<string, unknown>;

    /** 설치 소스 */
    source?: string;

    /** 다운로드/설치 횟수 */
    downloadCount?: number;

    /** 에러 메시지 */
    errorMessage?: string;
}

/**
 * GET /api/plugins
 * 설치된 플러그인 목록 조회
 */
export const GET: RequestHandler = async () => {
    try {
        // 파일 시스템에서 설치된 플러그인 목록 조회
        const installedPlugins = await getInstalledPlugins();

        // PluginWithStatus 형식으로 변환
        const plugins: PluginWithStatus[] = [];

        for (const plugin of installedPlugins.values()) {
            plugins.push({
                manifest: plugin.manifest,
                status: plugin.isActive ? 'active' : 'inactive',
                installedAt: new Date(), // TODO: 실제 설치 날짜 추적
                currentSettings: plugin.currentSettings,
                source: plugin.source // 'official' 또는 'custom'
            });
        }

        console.log(`✅ [API /plugins] ${plugins.length}개 플러그인 반환`);

        return json({
            plugins,
            total: plugins.length
        });
    } catch (error) {
        console.error('❌ [API /plugins] 플러그인 목록 조회 실패:', error);

        // 에러 발생 시 빈 배열 반환
        return json(
            {
                plugins: [],
                total: 0,
                error: '플러그인 목록을 불러오는 데 실패했습니다.'
            },
            { status: 500 }
        );
    }
};

/**
 * POST /api/plugins
 * 플러그인 활성화/비활성화
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { pluginId, action } = body as { pluginId: string; action: 'activate' | 'deactivate' };

        if (!pluginId || !action) {
            return json(
                { error: 'pluginId와 action은 필수입니다.' },
                { status: 400 }
            );
        }

        if (action !== 'activate' && action !== 'deactivate') {
            return json(
                { error: 'action은 activate 또는 deactivate이어야 합니다.' },
                { status: 400 }
            );
        }

        let success = false;

        if (action === 'activate') {
            success = await activatePlugin(pluginId);
        } else {
            success = await deactivatePlugin(pluginId);
        }

        if (!success) {
            return json(
                { error: `플러그인 ${action} 실패: ${pluginId}` },
                { status: 400 }
            );
        }

        console.log(`✅ [API /plugins] 플러그인 ${action}: ${pluginId}`);

        return json({
            success: true,
            pluginId,
            action
        });
    } catch (error) {
        console.error('❌ [API /plugins] 플러그인 액션 실패:', error);

        return json(
            { error: '플러그인 작업 처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
};
