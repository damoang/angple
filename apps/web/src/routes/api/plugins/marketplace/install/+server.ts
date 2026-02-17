/**
 * 플러그인 마켓플레이스 설치 API
 *
 * POST /api/plugins/marketplace/install - 공식 플러그인 설치 (활성화)
 *
 * 공식 플러그인은 이미 plugins/ 디렉터리에 존재하므로,
 * "설치" = 플러그인 활성화를 의미합니다.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { activatePlugin, isPluginInstalled, isCustomPlugin } from '$lib/server/plugins';

/**
 * POST /api/plugins/marketplace/install
 * 공식 플러그인 설치 (활성화)
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { pluginId } = body as { pluginId: string };

        // 필수 파라미터 검증
        if (!pluginId) {
            return json({ success: false, error: 'pluginId는 필수입니다.' }, { status: 400 });
        }

        // 플러그인이 설치되어 있는지 확인
        if (!isPluginInstalled(pluginId)) {
            return json(
                {
                    success: false,
                    error: '플러그인을 찾을 수 없습니다.'
                },
                { status: 404 }
            );
        }

        // 커스텀 플러그인은 마켓플레이스에서 설치 불가
        if (isCustomPlugin(pluginId)) {
            return json(
                {
                    success: false,
                    error: '커스텀 플러그인은 마켓플레이스에서 설치할 수 없습니다.'
                },
                { status: 400 }
            );
        }

        // 플러그인 활성화
        const success = await activatePlugin(pluginId);

        if (!success) {
            return json(
                {
                    success: false,
                    error: '플러그인 활성화에 실패했습니다.'
                },
                { status: 500 }
            );
        }

        return json({
            success: true,
            message: '플러그인이 성공적으로 설치되었습니다.',
            pluginId
        });
    } catch (error) {
        console.error('[API /marketplace/install] 플러그인 설치 실패:', error);

        return json(
            {
                success: false,
                error: '플러그인 설치 중 오류가 발생했습니다.'
            },
            { status: 500 }
        );
    }
};
