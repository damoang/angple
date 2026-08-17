import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/layout/hooks (Option C 3단계 이후 deprecated)
 *
 * 이 엔드포인트는 원래 활성 플러그인(hooks/components)을 s-maxage=300 으로 CDN 캐시했다.
 * 그러나 CDN 캐시는 admin 토글을 최대 5분간 stale 하게 만든다. 활성 플러그인 상태는
 * 이제 no-store 인 /api/plugins/active 에서 별도로 fetch 한다(+layout.svelte).
 *
 * 소비자 회귀 방지를 위해 라우트와 응답 키(activePlugins)는 유지하되 빈 배열로 중립화한다.
 * (클라이언트는 더 이상 이 라우트를 호출하지 않는다.)
 */
export const GET: RequestHandler = async () => {
    return json(
        { activePlugins: [] },
        {
            headers: {
                'Cache-Control': 'no-store'
            }
        }
    );
};
