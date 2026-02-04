import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { getActivePlugins } from '$lib/server/plugins';

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 */
export const load: LayoutServerLoad = async ({ url, locals }) => {
    console.log(`[SSR] Loading page: ${url.pathname}`);

    // 서버에서 활성 테마 조회 (깜박임 방지)
    const activeTheme = await getActiveTheme();
    console.log(`[SSR] Active theme: ${activeTheme?.manifest.id || 'null'}`);

    // 서버에서 활성 플러그인 목록 조회
    const activePlugins = await getActivePlugins();
    console.log(`[SSR] Active plugins: ${activePlugins.length}개`);

    // SSR 인증 정보 (hooks.server.ts에서 설정됨)
    console.log(`[SSR] User authenticated: ${!!locals.user}`);

    return {
        pathname: url.pathname,
        activeTheme: activeTheme?.manifest.id || null,
        themeSettings: activeTheme?.currentSettings || {},
        activePlugins: activePlugins.map((plugin) => ({
            id: plugin.manifest.id,
            name: plugin.manifest.name,
            version: plugin.manifest.version,
            hooks: plugin.manifest.hooks || [],
            components: plugin.manifest.components || [],
            settings: plugin.currentSettings || {}
        })),
        // SSR 인증 정보 전달 (클라이언트에서 apiClient 초기화에 사용)
        accessToken: locals.accessToken || null,
        user: locals.user || null
    };
};
