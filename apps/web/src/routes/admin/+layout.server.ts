import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Admin 레이아웃 서버 로드
 *
 * 관리자 권한 체크:
 * - mb_level >= 10 인 사용자만 접근 가능
 * - 미인증 시 /login 으로 리다이렉트
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
    // 설치 페이지는 권한 체크 제외
    if (url.pathname.startsWith('/install')) {
        return {};
    }

    // TODO: 실제 인증 구현 시 주석 해제
    // const user = locals.user;
    //
    // if (!user) {
    //     throw redirect(303, '/login?redirect=' + encodeURIComponent(url.pathname));
    // }
    //
    // if (user.mb_level < 10) {
    //     throw redirect(303, '/?error=forbidden');
    // }

    return {
        // 현재는 개발 모드로 권한 체크 비활성화
        isAdmin: true
    };
};
