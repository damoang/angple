import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { getActivePlugins } from '$lib/server/plugins';
import { loadMenus } from '$lib/server/menu-loader';
import { getCachedCelebrations } from '$lib/server/celebration';
import { getCachedBannersByPositions } from '$lib/server/ads/banners';
import { getSingoRole } from '$lib/server/singo-role';
import { hooks } from '@angple/hook-system';
import { env } from '$env/dynamic/private';

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 *
 * Promise.allSettled 사용: 개별 실패해도 사이트 전체가 크래시되지 않음
 *
 * celebration + banners: SSR에서 직접 로드하여 클라이언트 /api/init CDN 요청 제거
 */
export const load: LayoutServerLoad = async ({ locals, depends, url }) => {
    depends('app:layout');

    // Install wizard must not depend on runtime infra such as Redis, menus, banners, or MySQL.
    // CI/E2E runs this route before the full stack is provisioned.
    if (url.pathname.startsWith('/install')) {
        const installLayoutData = {
            activeTheme: null,
            themeSettings: {},
            activePlugins: [],
            menus: [],
            user: locals.user ?? null,
            accessToken: locals.accessToken ?? null,
            csrfToken: locals.csrfToken ?? null,
            singoRole: null,
            celebration: [],
            banners: {},
            ga4MeasurementId: ''
        };

        return hooks.applyFilters('layout_server_data', installLayoutData);
    }

    const singoRolePromise =
        (locals.user?.level ?? 0) >= 10 && locals.user?.id
            ? getSingoRole(locals.user.id).catch(() => null)
            : Promise.resolve(null);

    // 병렬로 모든 데이터 로드 (allSettled: 개별 실패 허용)
    const [
        themeResult,
        pluginsResult,
        menusResult,
        celebrationResult,
        bannersResult,
        singoRoleResult
    ] = await Promise.allSettled([
        getActiveTheme(),
        getActivePlugins(),
        loadMenus(),
        getCachedCelebrations(),
        getCachedBannersByPositions(['index-top', 'board-head', 'sidebar']),
        singoRolePromise
    ]);

    const activeTheme = themeResult.status === 'fulfilled' ? themeResult.value : null;
    const activePlugins = pluginsResult.status === 'fulfilled' ? pluginsResult.value : [];
    const menus = menusResult.status === 'fulfilled' ? menusResult.value : [];
    const celebration = celebrationResult.status === 'fulfilled' ? celebrationResult.value : [];
    const banners = bannersResult.status === 'fulfilled' ? bannersResult.value : {};
    const singoRole = singoRoleResult.status === 'fulfilled' ? singoRoleResult.value : null;

    // 실패 로깅 (크래시 안 함)
    for (const [name, r] of [
        ['Theme', themeResult],
        ['Plugins', pluginsResult],
        ['Menus', menusResult],
        ['Celebration', celebrationResult],
        ['Banners', bannersResult]
    ] as const) {
        if (r.status === 'rejected') {
            console.error(`[Layout] ${name} load failed:`, r.reason);
        }
    }

    const layoutData = {
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
        singoRole,
        // SSR에서 직접 로드 — 클라이언트 /api/init 호출 제거
        celebration,
        banners,
        // GA4 Measurement ID (env에서 로드, 미설정 시 미적용)
        ga4MeasurementId: env.GA4_MEASUREMENT_ID || ''
    };

    // 훅: 레이아웃 데이터 필터 (플러그인이 SSR 데이터를 수정/확장 가능)
    return hooks.applyFilters('layout_server_data', layoutData);
};
