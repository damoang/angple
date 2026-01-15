import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 */
export const load: LayoutServerLoad = async ({ url }) => {
    console.log(`[SSR] Loading page: ${url.pathname}`);

    // 서버에서 활성 테마 조회 (깜박임 방지)
    const activeTheme = await getActiveTheme();
    console.log(`[SSR] Active theme: ${activeTheme?.manifest.id || 'null'}`);

    return {
        pathname: url.pathname,
        activeTheme: activeTheme?.manifest.id || null,
        themeSettings: activeTheme?.currentSettings || {}
    };
};
