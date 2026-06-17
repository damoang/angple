import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { loadMenus } from '$lib/server/menu-loader';
import { getCachedLogoData } from '$lib/server/logo';
import { resolveLogoRequestLocale } from '$lib/utils/logo-schedule';
import { getWidgetLayout, getSidebarWidgetLayout } from '$lib/server/settings/index';
import { DEFAULT_WIDGETS, DEFAULT_SIDEBAR_WIDGETS } from '$lib/constants/default-widgets';

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

    // CSRF 토큰이 필요한 경로 (form POST 액션) — SSR_STRIP_USER여도 csrfToken 유지
    // 그렇지 않으면 form submit 시 빈 토큰으로 403 발생 (서명 저장, 탈퇴 등)
    const needsCsrf =
        url.pathname.startsWith('/member/') ||
        url.pathname.startsWith('/admin/') ||
        url.pathname.startsWith('/my/') ||
        // 쪽지함: 로그인 전용·비공개 페이지라 SSR 캐시 대상이 아니다. user strip 시
        // 새로고침마다 로그아웃→로그인 깜빡임(세션 끊김처럼 보임) 발생 (#12642).
        url.pathname === '/messages' ||
        url.pathname.startsWith('/messages/');
    const stripUser = env.SSR_STRIP_USER === 'true' && !needsCsrf;

    // Install wizard must not depend on runtime infra such as Redis, menus, banners, or MySQL.
    // CI/E2E runs this route before the full stack is provisioned.
    if (url.pathname.startsWith('/install')) {
        const installLayoutData = {
            activeTheme: null,
            themeSettings: {},
            activePlugins: [],
            menus: [],
            // SSR_STRIP_USER=true 시 user 제거 → SSR 캐시 가능 (클라이언트 /api/auth/me로 로드)
            // 단, CSRF 필요 경로(/member, /admin, /my)는 stripUser=false로 토큰 유지
            user: stripUser ? null : (locals.user ?? null),
            accessToken: stripUser ? null : (locals.accessToken ?? null),
            csrfToken: stripUser ? null : (locals.csrfToken ?? null),
            // #12719/#12723: SSR 세션 조회 일시 장애 여부. 클라이언트가 "로그아웃 확정"과
            // 구분해 재조회하도록 전달(로그아웃 깜빡임 방지).
            authDegraded: locals.authDegraded ?? false,

            celebration: [],
            banners: {},
            logoData: {
                active: null,
                schedules: [],
                previews: [],
                requestLocale,
                requestTimeZone: 'UTC'
            },
            ga4MeasurementId: '',
            widgetLayout: DEFAULT_WIDGETS,
            sidebarWidgetLayout: DEFAULT_SIDEBAR_WIDGETS
        };

        return hooks.applyFilters('layout_server_data', installLayoutData);
    }

    // 병렬로 SSR 필수 데이터만 로드 (allSettled: 개별 실패 허용)
    // celebration, banners, ga4는 /api/layout/init에서 클라이언트 로드 (비용 절감)
    const { getActivePlugins } = await import('$lib/server/plugins/index.js');
    const [
        themeResult,
        menusResult,
        logoResult,
        pluginsResult,
        widgetLayoutResult,
        sidebarWidgetLayoutResult
    ] = await Promise.allSettled([
        getActiveTheme(),
        isDataRequest ? Promise.resolve([]) : loadMenus(),
        getCachedLogoData(requestLocale),
        getActivePlugins(),
        getWidgetLayout(),
        getSidebarWidgetLayout()
    ]);

    const activeTheme = themeResult.status === 'fulfilled' ? themeResult.value : null;
    const menus = menusResult.status === 'fulfilled' ? menusResult.value : [];
    const widgetLayout =
        widgetLayoutResult.status === 'fulfilled' && widgetLayoutResult.value
            ? widgetLayoutResult.value
            : DEFAULT_WIDGETS;
    const sidebarWidgetLayout =
        sidebarWidgetLayoutResult.status === 'fulfilled' && sidebarWidgetLayoutResult.value
            ? sidebarWidgetLayoutResult.value
            : DEFAULT_SIDEBAR_WIDGETS;
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
    // settings는 /admin 경로에서만 필요 (관리자 UI) → 일반 페이지에서 null로 축소 (__data.json 절감)
    const isAdminPath = url.pathname.startsWith('/admin');
    const activePlugins =
        pluginsResult.status === 'fulfilled'
            ? pluginsResult.value.map((p) => ({
                  id: p.manifest.id,
                  name: p.manifest.name,
                  version: p.manifest.version,
                  hooks: [],
                  // components는 클라이언트 slot 등록(loadAllPluginComponents)에 필요하므로 SSR에 포함한다
                  components: p.manifest.components ?? [],
                  settings: isAdminPath ? p.currentSettings || null : null
              }))
            : [];

    for (const [name, r] of [
        ['Theme', themeResult],
        ['Menus', menusResult],
        ['Logo', logoResult],
        ['Plugins', pluginsResult],
        ['WidgetLayout', widgetLayoutResult],
        ['SidebarWidgetLayout', sidebarWidgetLayoutResult]
    ] as const) {
        if (r.status === 'rejected') {
            console.error(`[Layout] ${name} load failed:`, r.reason);
        }
    }

    // 도메인별 테마 오버라이드 (Phase 1, Path D′ — site-resolver 단독 소스)
    // hooks.server.ts 의 CompositeSiteResolver 가 host → locals.site 주입.
    // miss 시 locals.site === null → 기본 테마 적용.
    // 도메인-특이 매핑은 premium/site-overrides.json (open-core 코드에 도메인 hardcode 0).
    let resolvedThemeId = activeTheme?.manifest.id || null;
    let resolvedThemeSettings = activeTheme?.currentSettings || {};

    if (locals.site?.theme_id) {
        resolvedThemeId = locals.site.theme_id;
        resolvedThemeSettings = {};
    }

    const layoutData = {
        activeTheme: resolvedThemeId,
        themeSettings: resolvedThemeSettings,
        activePlugins,
        menus,
        // SSR_STRIP_USER=true 시 user 제거 → SSR 캐시 가능 (클라이언트 /api/auth/me로 로드)
        // 단, CSRF 필요 경로(/member, /admin, /my)는 stripUser=false로 토큰 유지
        user: stripUser ? null : (locals.user ?? null),
        accessToken: stripUser ? null : (locals.accessToken ?? null),
        csrfToken: stripUser ? null : (locals.csrfToken ?? null),
        // #12719/#12723: SSR 세션 조회 일시 장애 여부. 클라이언트가 "로그아웃 확정"과
        // 구분해 재조회하도록 전달(로그아웃 깜빡임 방지).
        authDegraded: locals.authDegraded ?? false,
        // logoData: previews 제거 (SSR 불필요), schedules는 header 로고에서 사용
        logoData: {
            active: logoData.active,
            schedules: logoData.schedules ?? [],
            requestLocale: logoData.requestLocale,
            requestTimeZone: logoData.requestTimeZone
        },
        // Phase 1 (Path D′): site-resolver 결과. miss 시 null. svelte:head 가 og:*/favicon 변수화에 사용.
        site: locals.site ?? null,
        // 모든 페이지에서 widgetLayoutStore 초기화 (Redis 캐시 사용, SSR 비용 미미)
        // 이전엔 +page.server.ts(홈)에서만 로드 → 글 상세/게시판 목록 등에서 사이드바 사용자 layout 미적용.
        widgetLayout,
        sidebarWidgetLayout
    };

    // 훅: 레이아웃 데이터 필터 (플러그인이 SSR 데이터를 수정/확장 가능)
    return hooks.applyFilters('layout_server_data', layoutData);
};
