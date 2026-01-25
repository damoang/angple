import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

/**
 * 글쓰기 페이지 서버 로드
 * 인증 체크 (로그인 필수)
 */
export const load: PageServerLoad = async ({ cookies }) => {
    // access_token 쿠키 확인 (간단한 인증 체크)
    // 실제 인증은 클라이언트에서 authStore로 수행
    // 서버에서는 기본적인 리다이렉트만 처리

    // TODO: 서버 사이드에서 JWT 검증 구현 시 여기에 추가
    // 현재는 클라이언트 사이드에서 인증 상태 확인

    return {};
};
