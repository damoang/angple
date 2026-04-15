import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { loadMenus } from '$lib/server/menu-loader';
import { getCachedLogoData } from '$lib/server/logo';
import { resolveLogoRequestLocale } from '$lib/utils/logo-schedule';

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
export const load: LayoutServerLoad = async ({
    locals,
    depends,
    url,
    cookies,
    request,
    isDataRequest
}) => {
    depends('app:layout');
    const requestLocale = resolveLogoRequestLocale({
        pathname: url.pathname,
        cookieLocale: cookies.get('angple_locale'),
        acceptLanguage: request.headers.get('accept-language')
    });

    // Install wizard must not depend on runtime infra such as Redis, menus, banners, or MySQL.
    // CI/E2E runs this route before the full stack is provisioned.
    if (url.pathname.startsWith('/install')) {
        const installLayoutData = {
            activeTheme: null,
            themeSettings: {},
            activePlugins: [],
            menus: [],
            // SSR_STRIP_USER=true 시 user 제거 → SSR 캐시 가능 (클라이언트 /api/auth/me로 로드)
            user: env.SSR_STRIP_USER === 'true' ? null : (locals.user ?? null),
            accessToken: env.SSR_STRIP_USER === 'true' ? null : (locals.accessToken ?? null),
            csrfToken: env.SSR_STRIP_USER === 'true' ? null : (locals.csrfToken ?? null),

            celebration: [],
            banners: {},
            logoData: {
                active: null,
                schedules: [],
                previews: [],
                requestLocale,
                requestTimeZone: 'UTC'
            },
            ga4MeasurementId: ''
        };

        return hooks.applyFilters('layout_server_data', installLayoutData);
    }

    // 병렬로 SSR 필수 데이터만 로드 (allSettled: 개별 실패 허용)
    // celebration, banners, ga4는 /api/layout/init에서 클라이언트 로드 (비용 절감)
    const { getActivePlugins } = await import('$lib/server/plugins/index.js');
    const [themeResult, menusResult, logoResult, pluginsResult] = await Promise.allSettled([
        getActiveTheme(),
        isDataRequest ? Promise.resolve([]) : loadMenus(),
        getCachedLogoData(requestLocale),
        getActivePlugins()
    ]);

    const activeTheme = themeResult.status === 'fulfilled' ? themeResult.value : null;
    const menus = menusResult.status === 'fulfilled' ? menusResult.value : [];
    const logoData =
        logoResult.status === 'fulfilled'
            ? logoResult.value
            : {
                  active: null,
                  schedules: [],
                  previews: [],
                  requestLocale,
                  requestTimeZone: 'UTC'
              };

    // 실패 로깅 (크래시 안 함)
    const activePlugins =
        pluginsResult.status === 'fulfilled'
            ? pluginsResult.value.map((p) => ({
                  id: p.manifest.id,
                  name: p.manifest.name,
                  version: p.manifest.version,
                  hooks: p.manifest.hooks || [],
                  components: p.manifest.components || [],
                  settings: p.currentSettings || {}
              }))
            : [];

    for (const [name, r] of [
        ['Theme', themeResult],
        ['Menus', menusResult],
        ['Logo', logoResult],
        ['Plugins', pluginsResult]
    ] as const) {
        if (r.status === 'rejected') {
            console.error(`[Layout] ${name} load failed:`, r.reason);
        }
    }

    // 도메인별 테마 오버라이드
    const host = url.host;
    let resolvedThemeId = activeTheme?.manifest.id || null;
    let resolvedThemeSettings = activeTheme?.currentSettings || {};

    // 도메인별 테마 오버라이드
    if (host === 'wikiang.org' || host === 'www.wikiang.org') {
        resolvedThemeId = 'wiki-theme';
        resolvedThemeSettings = {};
    } else if (host === 'angple.com' || host === 'www.angple.com') {
        resolvedThemeId = 'corporate-landing';
        resolvedThemeSettings = {};
    }

    const layoutData = {
        activeTheme: resolvedThemeId,
        themeSettings: resolvedThemeSettings,
        activePlugins,
        menus,
        // SSR_STRIP_USER=true 시 user 제거 → SSR 캐시 가능 (클라이언트 /api/auth/me로 로드)
        user: env.SSR_STRIP_USER === 'true' ? null : (locals.user ?? null),
        accessToken: env.SSR_STRIP_USER === 'true' ? null : (locals.accessToken ?? null),
        csrfToken: env.SSR_STRIP_USER === 'true' ? null : (locals.csrfToken ?? null),
        // logoData: previews 제거 (SSR 불필요), schedules는 header 로고에서 사용
        logoData: {
            active: logoData.active,
            schedules: logoData.schedules ?? [],
            requestLocale: logoData.requestLocale,
            requestTimeZone: logoData.requestTimeZone
        }
    };

    // 훅: 레이아웃 데이터 필터 (플러그인이 SSR 데이터를 수정/확장 가능)
    return hooks.applyFilters('layout_server_data', layoutData);
};
