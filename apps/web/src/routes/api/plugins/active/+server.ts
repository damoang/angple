/**
 * 활성화된 플러그인 목록 조회 API
 *
 * GET /api/plugins/active - 활성화된 모든 플러그인 반환
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getActivePlugins } from '$lib/server/plugins';

/**
 * GET /api/plugins/active
 * 활성화된 플러그인 목록 조회
 */
export const GET: RequestHandler = async () => {
    try {
        const activePlugins = await getActivePlugins();

        return json(
            {
                plugins: activePlugins.map((plugin) => ({
                    id: plugin.manifest.id,
                    name: plugin.manifest.name,
                    version: plugin.manifest.version,
                    hooks: plugin.manifest.hooks || [],
                    components: plugin.manifest.components || [],
                    settings: plugin.currentSettings || {}
                })),
                total: activePlugins.length
            },
            {
                // ⛔ CDN/edge 캐시 금지. 활성 플러그인 상태의 authoritative source 다 —
                //    admin 토글이 즉시 반영되어야 한다(오리진 캐시는 pub/sub 로 무효화됨).
                //    layout/init·layout/hooks 의 s-maxage(CDN) 와 분리된 이유가 이것이다.
                headers: {
                    'Cache-Control': 'no-store'
                }
            }
        );
    } catch (error) {
        console.error('❌ [API /plugins/active] 활성 플러그인 조회 실패:', error);

        return json(
            {
                plugins: [],
                total: 0,
                error: '활성 플러그인 목록을 불러오는 데 실패했습니다.'
            },
            { status: 500 }
        );
    }
};
