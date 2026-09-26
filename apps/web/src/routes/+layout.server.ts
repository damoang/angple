import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { loadMenus, loadTagNavMenus } from '$lib/server/menu-loader';
import { getCachedLogoData } from '$lib/server/logo';
import { resolveLogoRequestLocale } from '$lib/utils/logo-schedule';
import { getWidgetLayout, getSidebarWidgetLayout } from '$lib/server/settings/index';
import { getCachedCelebrations } from '$lib/server/celebration';
import { getCachedBannersByPositions } from '$lib/server/ads/banners';
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
            // ⭐ user 를 벗겨도 **로그인했다는 사실**만은 남긴다(불리언 하나, 개인정보 아님).
            //    SSR 은 이미 locals.user 로 알고 있는데 캐시 때문에 페이로드에서 뺄 뿐이다.
            //    이게 없으면 로그인 전용 UI 가 하이드레이션 후에 **나타나며 화면을 민다**.
            // ⛔ 로그인 HTML 은 캐시규칙 #19·#23·#24 가 angple_sid 등 4종으로 이미 제외하므로
            //    공유 캐시 안전성에 영향 없다.
            isLoggedIn: !!locals.user,
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
    // ga4 는 /api/layout/init 에서 클라이언트 로드. celebration·상단 banners 는 화면 높이를
    // 정하므로 SSR 에서 내린다(아래 주석 참조).
    const { getActivePlugins } = await import('$lib/server/plugins/index.js');
    const [
        themeResult,
        menusResult,
        logoResult,
        pluginsResult,
        widgetLayoutResult,
        sidebarWidgetLayoutResult,
        celebrationResult,
        tagNavResult,
        bannersResult
    ] = await Promise.allSettled([
        getActiveTheme(),
        isDataRequest ? Promise.resolve([]) : loadMenus(),
        getCachedLogoData(requestLocale),
        getActivePlugins(),
        getWidgetLayout(),
        getSidebarWidgetLayout(),
        // ⛔ 마음메시지를 여기서 같이 내린다. 지금까지 홈(+page.server.ts)에만 있어서
        //    다른 페이지에서는 위젯이 SSR 에 **아무것도 못 그리고**(높이 0) 하이드레이션
        //    후 81px 이 생기며 아래 위젯과 footer 를 밀었다(2026-08-20 실측).
        //    getCachedCelebrations 는 KST 날짜 키 서버 캐시라 페이지마다 재조회하지 않는다.
        isDataRequest ? Promise.resolve([]) : getCachedCelebrations(false),
        isDataRequest ? Promise.resolve(null) : loadTagNavMenus(),
        // ⛔ 자체 배너 유무를 SSR 이 알아야 상단 배너가 첫 페인트부터 맞는 높이로 그려진다.
        //    지금까지는 클라이언트 onMount 가 /api/sidebar/items 를 부른 뒤 43px 플레이스홀더를
        //    100px GAM 슬롯으로 **교체**해 tag-nav 이하 전부가 57px 밀렸다(2026-09-21~, 모바일 CLS
        //    p75 0.002→0.076). 같은 함수를 /api/layout/init 이 이미 매 페이지 호출하므로 새 비용이
        //    아니라 시점 이동이다(60초 캐시·singleflight·1.2초 타임아웃 내장). 데이터 요청(SPA
        //    네비게이션)에서는 null 로 두어 클라이언트 캐시 경로를 그대로 탄다.
        // ⛔ position 목록은 /api/layout/init 과 **같아야** 한다 — 캐시 키가 정렬 조인이라 다르면
        //    서버 캐시 항목이 둘로 갈려 ads 서버 호출이 파드당 분당 2건 늘어난다. sidebar 는
        //    컴포넌트가 시드를 읽지 않으므로 포함해도 동작 변화 없음.
        isDataRequest
            ? Promise.resolve(null)
            : getCachedBannersByPositions(['index-top', 'board-head', 'sidebar'])
    ]);
    // 상단 tag-nav 메뉴 (menus.show_in_tagnav). null/실패면 프론트가 하드코딩 폴백.
    const tagNavMenus = tagNavResult.status === 'fulfilled' ? tagNavResult.value : null;

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
        ['SidebarWidgetLayout', sidebarWidgetLayoutResult],
        ['Celebration', celebrationResult],
        ['Banners', bannersResult]
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
        // 상단 tag-nav 메뉴 (menus 테이블 구동). null 이면 tag-nav 가 하드코딩 폴백.
        tagNavMenus,
        // 마음메시지 위젯의 SSR 렌더용. 실패해도 빈 배열로 사이트는 정상 동작한다.
        celebration: celebrationResult.status === 'fulfilled' ? celebrationResult.value : [],
        // 상단 자체 배너(position → 목록). null = 모름(실패·데이터 요청) → DamoangBanner 가
        // 클라이언트 fetch 로 퇴화. 키가 있고 빈 배열이면 「없음이 확정」이라 GAM 폴백을 바로 그린다.
        banners: bannersResult.status === 'fulfilled' ? bannersResult.value : null,
        // SSR_STRIP_USER=true 시 user 제거 → SSR 캐시 가능 (클라이언트 /api/auth/me로 로드)
        // 단, CSRF 필요 경로(/member, /admin, /my)는 stripUser=false로 토큰 유지
        user: stripUser ? null : (locals.user ?? null),
        // ⭐ user 를 벗겨도 **로그인했다는 사실**만은 남긴다(불리언 하나, 개인정보 아님).
        //    SSR 은 이미 locals.user 로 알고 있는데 캐시 때문에 페이로드에서 뺄 뿐이다.
        //    이게 없으면 로그인 전용 UI 가 하이드레이션 후에 **나타나며 화면을 민다**.
        // ⛔ 로그인 HTML 은 캐시규칙 #19·#23·#24 가 angple_sid 등 4종으로 이미 제외하므로
        //    공유 캐시 안전성에 영향 없다.
        isLoggedIn: !!locals.user,
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
