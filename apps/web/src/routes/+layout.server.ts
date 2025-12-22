import type { LayoutServerLoad } from './$types';

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 */
export const load: LayoutServerLoad = async ({ url }) => {
    console.log(`[SSR] Loading page: ${url.pathname}`);

    // 서버에서 초기 데이터 로드 (필요시)
    // 예: 사용자 인증 상태 확인
    // const user = await apiClient.getCurrentUser();

    return {
        pathname: url.pathname
        // user
    };
};
