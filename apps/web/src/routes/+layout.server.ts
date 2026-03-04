import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { getActivePlugins } from '$lib/server/plugins';
import { loadMenus } from '$lib/server/menu-loader';

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 *
 * Promise.allSettled 사용: 테마/플러그인/메뉴 중 하나가 실패해도 사이트 전체가 크래시되지 않음
 */
export const load: LayoutServerLoad = async ({ locals }) => {
    // 병렬로 테마, 플러그인, 메뉴 데이터 로드 (allSettled: 개별 실패 허용)
    const [themeResult, pluginsResult, menusResult] = await Promise.allSettled([
        getActiveTheme(),
        getActivePlugins(),
        loadMenus()
    ]);

    const activeTheme = themeResult.status === 'fulfilled' ? themeResult.value : null;
    const activePlugins = pluginsResult.status === 'fulfilled' ? pluginsResult.value : [];
    const menus = menusResult.status === 'fulfilled' ? menusResult.value : [];

    // 실패 로깅 (크래시 안 함)
    for (const [name, r] of [
        ['Theme', themeResult],
        ['Plugins', pluginsResult],
        ['Menus', menusResult]
    ] as const) {
        if (r.status === 'rejected') {
            console.error(`[Layout] ${name} load failed:`, r.reason);
        }
    }

    return {
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
        csrfToken: locals.csrfToken ?? null,
        isAdmin: (locals.user?.level ?? 0) >= 10
    };
};
