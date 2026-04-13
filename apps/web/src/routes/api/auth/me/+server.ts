import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * 현재 로그인 유저 정보 반환 (클라이언트 auth 초기화용)
 *
 * Layout SSR 캐시 활성화 시, SSR 응답에서 user/token을 제거하고
 * 클라이언트가 이 엔드포인트로 인증 데이터를 로드합니다.
 *
 * Cache-Control: private, no-store — 절대 공유 캐시에 저장되지 않음
 */
export const GET: RequestHandler = async ({ locals }) => {
    return json(
        {
            user: locals.user ?? null,
            accessToken: locals.accessToken ?? null,
            csrfToken: locals.csrfToken ?? null
        },
        {
            headers: {
                'Cache-Control': 'private, no-store, no-cache'
            }
        }
    );
};
