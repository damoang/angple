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
 *
 * 플러그인 설정값(settings)은 관리자 호출에만 싣는다. 공개 호출(레이아웃의 목록 재확인)은
 * id·hooks·components 만 쓰고 설정값은 쓰지 않는다 — 레이아웃 데이터도 /admin 밖에서는
 * settings 를 null 로 내린다(+layout.server.ts). hooks·components 는 플러그인 코드에 들어 있는
 * manifest 값이고, 목록이 바뀌었을 때 클라이언트가 플러그인 Hook 을 등록하는 데 필요하다.
 */
export const GET: RequestHandler = async ({ locals }) => {
    // ⛔ mb_level 10 = 관리자(requireAdmin 과 같은 기준). as_level 과 혼동 금지.
    const isAdmin = !!locals.user && locals.user.level >= 10;

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
                    settings: isAdmin ? plugin.currentSettings || {} : {}
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
