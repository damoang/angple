/**
 * GET /api/config/kakao-share-key
 *
 * 카카오톡 공유(share.ts)가 클릭 시점에 1회 호출하는 지연 엔드포인트.
 * 카카오 JS SDK 앱키(=공개키)를 g5_config(cf_kakao_js_apikey, OAuth 키와 같은 SoT)에서
 * 읽어 내려준다. #13454 — 예전엔 빌드타임 VITE_KAKAO_JS_KEY 를 읽었는데 그 값이 비어
 * Kakao.init("") 로 빌드돼 공유가 "인증 실패"였다. 이제 DB 값을 런타임으로 읽어
 * 시크릿 복제·재빌드 없이 동작한다.
 *
 * ⛔ JS 앱키는 원래 클라이언트에 노출되는 공개키다. 이 라우트는 **JS 키만** 반환하며
 *    REST 키·client_secret 등 비공개 값은 절대 내려주지 않는다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getOAuthKeys } from '$lib/server/auth/oauth/config';

export const GET: RequestHandler = async () => {
    let key = '';
    try {
        key = (await getOAuthKeys()).kakao_js_key || '';
    } catch {
        // g5_config 조회 실패 시 빈 키 — share.ts 가 false 반환 후 안내 토스트
        key = '';
    }

    return json(
        { key },
        {
            headers: {
                // 앱키는 거의 안 바뀌므로 넉넉히 캐시. getOAuthKeys 자체도 5분 메모리 캐시.
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400, max-age=600'
            }
        }
    );
};
