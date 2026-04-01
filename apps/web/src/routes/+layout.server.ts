import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { loadMenus } from '$lib/server/menu-loader';
import { getCachedLogoData } from '$lib/server/logo';
import { resolveLogoRequestLocale } from '$lib/utils/logo-schedule';

import { hooks } from '@angple/hook-system';

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 *
 * Promise.allSettled 사용: 개별 실패해도 사이트 전체가 크래시되지 않음
 *
 * celebration + banners: SSR에서 직접 로드하여 클라이언트 /api/init CDN 요청 제거
 */
export const load: LayoutServerLoad = async ({ locals, depends, url, cookies, request }) => {
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
            user: locals.user ?? null,
            accessToken: locals.accessToken ?? null,
            csrfToken: locals.csrfToken ?? null,

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
    // celebration, banners, plugins, ga4는 /api/layout/init에서 클라이언트 로드 (비용 절감)
    const [themeResult, menusResult, logoResult] = await Promise.allSettled([
        getActiveTheme(),
        loadMenus(),
        getCachedLogoData(requestLocale)
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
    for (const [name, r] of [
        ['Theme', themeResult],
        ['Menus', menusResult],
        ['Logo', logoResult]
    ] as const) {
        if (r.status === 'rejected') {
            console.error(`[Layout] ${name} load failed:`, r.reason);
        }
    }

    const layoutData = {
        activeTheme: activeTheme?.manifest.id || null,
        themeSettings: activeTheme?.currentSettings || {},
        activePlugins: [] as Array<{
            id: string;
            name: string;
            version: string;
            hooks: unknown[];
            components: unknown[];
            settings: Record<string, unknown>;
        }>,
        menus,
        user: locals.user ?? null,
        accessToken: locals.accessToken ?? null,
        csrfToken: locals.csrfToken ?? null,
        celebration: [] as unknown[],
        banners: {} as Record<string, unknown>,
        logoData,
        ga4MeasurementId: ''
    };

    // 훅: 레이아웃 데이터 필터 (플러그인이 SSR 데이터를 수정/확장 가능)
    return hooks.applyFilters('layout_server_data', layoutData);
};
