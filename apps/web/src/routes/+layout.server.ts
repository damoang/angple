import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { getActivePlugins } from '$lib/server/plugins';
import { loadMenus } from '$lib/server/menu-loader';

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 */
export const load: LayoutServerLoad = async ({ url, locals }) => {
    // 병렬로 테마, 플러그인, 메뉴 데이터 로드
    const [activeTheme, activePlugins, menus] = await Promise.all([
        getActiveTheme(),
        getActivePlugins(),
        loadMenus()
    ]);

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
        menus,
        user: locals.user ?? null,
        accessToken: locals.accessToken ?? null,
        isAdmin: (locals.user?.level ?? 0) >= 10
    };
};
