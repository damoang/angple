<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount, untrack } from 'svelte';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import type { Component } from 'svelte';
    import { browser } from '$app/environment';
    import { afterNavigate, onNavigate } from '$app/navigation';
    import { navigating } from '$app/state';
    import { page } from '$app/stores';
    import { configureSeo } from '$lib/seo';
    import { authActions, authStore } from '$lib/stores/auth.svelte';
    import { toast } from 'svelte-sonner';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { collectAndReportFingerprint } from '$lib/fingerprint/device-fingerprint';
    import { themeStore } from '$lib/stores/theme.svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import type { ActivePlugin } from '$lib/stores/plugin.svelte';
    import { menuStore } from '$lib/stores/menu.svelte';
    import { loadThemeHooks } from '$lib/hooks/theme-loader';
    import { loadThemeComponents } from '$lib/utils/theme-component-loader';
    import { loadAllPluginHooks } from '$lib/hooks/plugin-loader';
    import { loadAllPluginComponents } from '$lib/utils/plugin-component-loader';
    import { doAction } from '$lib/hooks/registry';
    import { initBuiltinHooks } from '$lib/hooks';
    import { registerDefaultSlots } from '$lib/components/slot-defaults';
    import { loadPluginComponent, loadPluginLib } from '$lib/utils/plugin-optional-loader';
    import DefaultLayout from '$lib/layouts/default-layout.svelte';
    import { getThemeLayout } from '$lib/themes/layout-registry';
    import { initFromSSR as initAppData } from '$lib/stores/app-init.svelte';
    import { initFromData as initCelebrationFromData } from '$lib/stores/celebration.svelte';
    import type { CelebrationBanner } from '$lib/stores/celebration.svelte';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte';
    import { updatePageTargeting } from '$lib/components/ui/ad-slot/ad-slot-registry.js';
    import {
        consumePendingAuthEvent,
        initGA4,
        resolvePageContext,
        trackPageView
    } from '$lib/services/ga4';
    import { detectAdblockOnce } from '$lib/services/ad-telemetry';
    import { initWebVitalsRum } from '$lib/services/web-vitals-rum';
    import { AdblockNotice } from '$lib/components/features/adblock-notice';
    import type { MenuItem } from '$lib/api/types';
    import { readUserBasicFromCookie } from '$lib/utils/user-basic-client';
    import { env } from '$env/dynamic/public';

    // ⭐ 진짜 하이드레이션 경계 (2026-08-25 계측).
    //    이 줄은 **루트 컴포넌트가 하이드레이션되는 그 순간** 동기로 실행된다.
    //    hooks.client.ts 의 __angpleBundleAt 은 모듈 평가 시각이라, 그 뒤 라우트 청크를
    //    동적 import 해 평가하는 시간(느린 CPU 에서 수십 ms)만큼 **앞으로 헐겁다**.
    //    그 창에서 일어난 외부 변형이 "Svelte 자신의 동작"으로 무죄 방면되는 걸 막는다.
    //    ⛔ onMount 에 두면 안 된다 — 거기는 하이드레이션이 이미 끝난 뒤다.
    if (browser) {
        try {
            (window as unknown as Record<string, unknown>).__angpleHydrateAt = Math.round(
                performance.now()
            );
        } catch {
            /* 관측용 */
        }
    }

    const LAYOUT_INIT_STORAGE_KEY = 'angple:layout-init:v1';
    const LAYOUT_INIT_STORAGE_TTL_MS = 5 * 60 * 1000;
    const MENU_STORAGE_KEY = 'angple:layout-menus:v1';
    const MENU_STORAGE_TTL_MS = 60 * 60 * 1000;

    type LayoutInitPayload = {
        celebration?: CelebrationBanner[];
        banners?: Record<string, any[]>;
        activePlugins?: ActivePlugin[];
        ga4MeasurementId?: string;
    };

    type CachedMenusPayload = {
        menus: MenuItem[];
        savedAt: number;
    };

    function readCachedMenus(): MenuItem[] | null {
        if (!browser) return null;

        try {
            const raw = localStorage.getItem(MENU_STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw) as CachedMenusPayload;
            if (
                !Array.isArray(parsed.menus) ||
                typeof parsed.savedAt !== 'number' ||
                Date.now() - parsed.savedAt > MENU_STORAGE_TTL_MS
            ) {
                localStorage.removeItem(MENU_STORAGE_KEY);
                return null;
            }

            return parsed.menus;
        } catch {
            return null;
        }
    }

    function writeCachedMenus(menus: MenuItem[]) {
        if (!browser || menus.length === 0) return;

        try {
            const payload: CachedMenusPayload = {
                menus,
                savedAt: Date.now()
            };
            localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // noop
        }
    }

    // 지연 로딩 모듈 참조
    let keyboardShortcutsMod: typeof import('$lib/services/keyboard-shortcuts.svelte') | null =
        $state(null);
    let boardFavoritesMod: typeof import('$lib/stores/board-favorites.svelte') | null =
        $state(null);
    let aplogMod: typeof import('$lib/services/aplog') | null = $state(null);
    let LazyToaster: Component | null = $state(null);
    let LazyShortcutButtons: Component | null = $state(null);

    const { children, data } = $props(); // Svelte 5: SSR 데이터 받기

    // 인증 상태 동기화 (클라이언트 전용 — 모듈 레벨 $state는 SSR에서 요청간 공유되므로)
    function syncAuth(d: typeof data) {
        if (d.user && d.accessToken) {
            authActions.initFromSSR(
                {
                    id: d.user.id,
                    nickname: d.user.nickname ?? '',
                    level: d.user.level,
                    as_level: d.user.as_level,
                    mb_certify: d.user.mb_certify ?? '',
                    mb_image: d.user.mb_image,
                    mb_image_updated_at: d.user.mb_image_updated_at,
                    advertiser_end_date: d.user.advertiser_end_date,
                    advertiser_status: d.user.advertiser_status
                },
                d.accessToken
            );
            // memberLevelStore에도 현재 사용자 레벨 동기화
            if (d.user.id && d.user.as_level !== undefined) {
                memberLevelStore.updateLevel(d.user.id, d.user.as_level);
            }
        } else if (d.user) {
            authActions.initFromSSR(
                {
                    id: d.user.id,
                    nickname: d.user.nickname ?? '',
                    level: d.user.level,
                    as_level: d.user.as_level,
                    mb_certify: d.user.mb_certify ?? '',
                    mb_image: d.user.mb_image,
                    mb_image_updated_at: d.user.mb_image_updated_at,
                    advertiser_end_date: d.user.advertiser_end_date,
                    advertiser_status: d.user.advertiser_status
                },
                ''
            );
            if (d.user.id && d.user.as_level !== undefined) {
                memberLevelStore.updateLevel(d.user.id, d.user.as_level);
            }
        } else if (d.authDegraded) {
            // #12719/#12723: SSR 세션 조회가 일시 장애(타임아웃)로 비었을 뿐 로그아웃 확정이 아님.
            // initAuth()로 "비로그인 확정" 처리하면 다음 네비게이션까지 로그아웃으로 깜빡인다.
            // 이 경우에만 클라이언트에서 현재 사용자를 재조회(isLoading 유지 → 헤더는 로딩 표시,
            // 로그아웃 표시 아님). 정상 경로는 변경 없음 = SSR 권위 + heap-safe 설계 유지.
            authActions.fetchCurrentUser();
        } else {
            authActions.initAuth();
        }
    }

    // $effect: SPA 네비게이션 시 data.user 변경 감지 → 인증 상태 동기화
    let authInitialized = false;
    $effect(() => {
        if (authInitialized) {
            untrack(() => syncAuth(data));
        }
    });

    // /admin, /install 경로 여부 확인 (테마 레이아웃 적용 안함)
    const isAdminRoute = $derived($page.url.pathname.startsWith('/admin'));
    const isInstallRoute = $derived($page.url.pathname.startsWith('/install'));

    // <SeoHead> 로 자체 meta description 을 렌더하는 라우트 목록.
    // 이 라우트들에서 layout 이 기본 description 을 함께 내보내면 태그가 2개가 되어
    // 검색엔진(first-wins)이 사이트 슬로건을 채택 → 전 페이지 동일 description 중복.
    // SeoHead 를 새 라우트에 추가하면 여기에도 route id 를 추가할 것.
    const SEO_HEAD_ROUTES = ['/', '/[boardId]', '/[boardId]/[postId]', '/groups', '/explore'];
    const routeHasSeoHead = $derived(
        SEO_HEAD_ROUTES.includes($page.route.id ?? '') ||
            ($page.route.id ?? '').startsWith('/games')
    );

    // 동적 import: member-memo 플러그인 모달
    let MemoModal = $state<Component | null>(null);

    $effect(() => {
        if (pluginStore.isPluginActive('member-memo')) {
            loadPluginComponent('member-memo', 'memo-modal').then((c) => (MemoModal = c));
        }
    });

    // SEO 기본 설정 초기화
    // SSR에서 url.origin이 http://로 올 수 있으므로 (nginx 프록시 뒤),
    // 비 localhost 도메인은 항상 https:// 사용 (hydration mismatch 방지)
    const siteUrl = $derived.by(() => {
        const origin = $page.url.origin;
        if (origin.startsWith('http://') && !origin.includes('localhost')) {
            return origin.replace('http://', 'https://');
        }
        return origin;
    });

    // multi-tenant: host 로 resolve 된 site.title 우선 (VITE_SITE_NAME 은 빌드타임 상수).
    // NOTE: siteDefaults 는 meta-helper 의 module-level 전역 — SSR 동시요청 간 이론상 race
    // 가능. 단일 render 는 동기라 실무상 안전. 향후 per-request context 로 이전 권장.
    configureSeo({
        siteName: data.site?.title || import.meta.env.VITE_SITE_NAME || 'Angple',
        siteUrl
    });

    // SSR에서 받은 플러그인으로 즉시 초기화 (리액션 등 플러그인 SSR 렌더 보장)
    if (data.activePlugins?.length) {
        pluginStore.initFromServer(data.activePlugins);
    }

    // SSR에서 받은 widget layout 으로 즉시 초기화 (사이드바 widget SSR 렌더 보장)
    // 이전엔 +page.svelte(홈)에서만 호출 → 글 상세/게시판 목록에서 default 사용 → 사용자 layout 누락.
    if (data.widgetLayout || data.sidebarWidgetLayout) {
        widgetLayoutStore.initFromServer(
            data.widgetLayout ?? null,
            data.sidebarWidgetLayout ?? null
        );
    }

    // SSR에서 받은 테마/메뉴로 스토어 초기화 (깜박임 방지!)
    // plugins는 /api/layout/init에서 클라이언트 로드 (비용 절감)
    $effect(() => {
        const theme = data.activeTheme;
        const menus = data.menus || [];
        const plugins = data.activePlugins || [];
        const widgetLayout = data.widgetLayout;
        const sidebarWidgetLayout = data.sidebarWidgetLayout;
        untrack(() => {
            themeStore.initFromServer(theme);
            if (menus.length > 0) {
                menuStore.initFromServer(menus);
                writeCachedMenus(menus);
            }
            if (plugins.length > 0) {
                pluginStore.initFromServer(plugins);
            }
            if (widgetLayout || sidebarWidgetLayout) {
                widgetLayoutStore.initFromServer(widgetLayout ?? null, sidebarWidgetLayout ?? null);
            }
        });
    });

    // 회원 메모 뱃지 지연 로딩 제거: member-memo 는 뱃지 컴포넌트(memo-badge)와 memo-store 가
    // 코드 스플릿된 별도 청크라, 목록/상세의 per-page $effect 가 하이드레이션 후에야 동적
    // import() 를 시작해 뱃지가 뒤늦게 떴다. 로그인 + 플러그인 활성 시 해당 청크를 미리 로드해
    // import() 캐시를 데워두면, 각 페이지는 이미 로드된 청크를 즉시 사용한다.
    // ⚠️ auth 는 별도 onMount 의 syncAuth/fast-path 로 하이드레이션 후 늦게 확립되므로
    // onMount 로는 프리로드 시점에 isAuthenticated 가 아직 false → 스킵된다. $effect 로
    // authStore.isAuthenticated 변화를 추적해, 로그인 확정 즉시 1회 발화한다.
    // fire-and-forget — 실패해도 기존 per-page 지연 로딩으로 폴백되어 회귀 없음.
    let memoChunksPrefetched = false;
    $effect(() => {
        if (memoChunksPrefetched) return;
        if (!authStore.isAuthenticated) return;
        if (!pluginStore.isPluginActive('member-memo')) return;
        memoChunksPrefetched = true;
        loadPluginComponent('member-memo', 'memo-badge').catch(() => {});
        loadPluginComponent('member-memo', 'memo-inline-editor').catch(() => {});
        loadPluginLib('member-memo', 'memo-store').catch(() => {});
    });

    // 디바이스 핑거프린트 수집(로그인 1회, 수집기 내부 1일 throttle). 위와 동일 사유로
    // onMount 시점엔 auth 미하이드레이션(isAuthenticated=false)이라 스킵되므로, $effect 로
    // 로그인 확정 시점에 1회 발화한다. (기존 onMount 호출은 사실상 미발화 = fp 0건 원인)
    let fpReported = false;
    $effect(() => {
        if (fpReported) return;
        if (!browser || !authStore.isAuthenticated) return;
        fpReported = true;
        void collectAndReportFingerprint();
    });

    // 서버 read-set(L2, Redis) 병합 — 크로스기기 읽음 표시.
    // localStorage(L1)에 없는 항목만 추가(기존 로컬 timestamp 보존).
    //
    // ⛔ 위 핑거프린트와 정확히 같은 함정으로 죽어 있던 코드다. onMount 안에서
    //    authStore.isAuthenticated 로 게이트되어 있었는데, onMount 는 auth 하이드레이션
    //    전에 돌아 항상 false 였다. 2026-07-29 nginx 실측: /api/auth/me 는 6,793건인데
    //    GET /api/read-posts 는 **0건**. 즉 크로스기기 읽음 표시가 한 번도 동작한 적이 없다.
    //    (PUT 은 auth 게이트 밖이라 쓰기만 살아 있었다 — 쌓기만 하고 못 읽는 상태)
    let readSetMerged = false;
    $effect(() => {
        if (readSetMerged) return;
        if (!browser || !authStore.isAuthenticated) return;
        readSetMerged = true;
        fetch('/api/read-posts', { headers: { accept: 'application/json' } })
            .then((res) => (res.ok ? res.json() : null))
            .then((payload: { posts?: string[] } | null) => {
                if (payload?.posts?.length) {
                    readPostsStore.mergeServerReadPosts(payload.posts);
                }
            })
            .catch(() => {
                // 병합 실패해도 로컬(L1) 읽음 표시는 유지
            });
    });

    // UI 설정(L2, MySQL+Redis) 병합 — 크로스기기·ITP 대비(#12891).
    // 서버 값 있음 → 서버가 진실 원본으로 로컬에 반영.
    // 서버 비어있음(첫 도입) → 현재 로컬 설정을 서버로 올려 마이그레이션(무손실).
    //
    // ⛔ 같은 함정. GET /api/my/ui-settings 실측 **0건**(PUT 만 5건).
    //    g5_da_member_ui_settings 채택률이 회원 59,869명 중 1,577행(2.6%)으로 낮았던 것도
    //    이것으로 설명된다 — 저장은 되는데 어느 기기에서도 다시 읽히지 않았다.
    let uiSettingsMerged = false;
    $effect(() => {
        if (uiSettingsMerged) return;
        if (!browser || !authStore.isAuthenticated) return;
        uiSettingsMerged = true;
        fetch('/api/my/ui-settings', { headers: { accept: 'application/json' } })
            .then((res) => (res.ok ? res.json() : null))
            .then((payload: { settings?: Record<string, unknown> | null } | null) => {
                if (payload?.settings) {
                    uiSettingsStore.mergeServerSettings(
                        payload.settings as Partial<
                            import('$lib/stores/ui-settings.svelte').UiSettings
                        >
                    );
                } else {
                    // 서버에 저장값 없음 → 로컬 설정을 서버로 마이그레이션
                    uiSettingsStore.syncToServer();
                }
            })
            .catch(() => {
                // 실패해도 로컬(L1) 설정은 그대로 유지
            });
    });

    // 메뉴 데이터 변경 시 키보드 단축키 빌드 (모듈 로드 후 활성화)
    $effect(() => {
        if (!keyboardShortcutsMod) return;
        const menus = menuStore.menus;
        const ks = keyboardShortcutsMod;
        untrack(() => {
            ks.keyboardShortcuts.buildFromMenus(menus);
        });
    });

    // 즐겨찾기 → 숫자 단축키 연결 (모듈 로드 후 활성화)
    $effect(() => {
        if (!keyboardShortcutsMod || !boardFavoritesMod) return;
        const { normal, shift } = boardFavoritesMod.boardFavoritesStore.toShortcutMap();
        const ks = keyboardShortcutsMod;
        untrack(() => {
            ks.keyboardShortcuts.setUserShortcuts(normal, shift);
        });
    });

    // 로그인 상태 변경 시 즐겨찾기 서버 동기화
    $effect(() => {
        if (!boardFavoritesMod) return;
        const isAuth = authStore.isAuthenticated;
        const bfStore = boardFavoritesMod.boardFavoritesStore;
        untrack(() => {
            bfStore.setLoggedIn(isAuth);
        });
    });

    const NAVIGATION_STALL_TIMEOUT_MS = 4000;
    const NAVIGATION_RECOVERY_KEY = '__angple_navigation_recovery__';

    // SPA 내비게이션이 URL만 바뀌고 화면 갱신이 멈추는 경우를 대비해
    // 일정 시간 안에 완료되지 않으면 대상 URL로 1회 강제 새로고침한다.
    onNavigate((navigation) => {
        if (!browser || navigation.willUnload || !navigation.to?.url) return;

        const targetUrl = navigation.to.url.toString();
        const timer = window.setTimeout(() => {
            try {
                const raw = sessionStorage.getItem(NAVIGATION_RECOVERY_KEY);
                const prev = raw
                    ? (JSON.parse(raw) as { url?: string; ts?: number })
                    : { url: '', ts: 0 };
                const now = Date.now();
                if (prev.url === targetUrl && now - (prev.ts ?? 0) < 15_000) return;
                sessionStorage.setItem(
                    NAVIGATION_RECOVERY_KEY,
                    JSON.stringify({ url: targetUrl, ts: now })
                );
            } catch {
                // 저장소 접근 실패 시에도 복구는 진행
            }
            window.location.assign(targetUrl);
        }, NAVIGATION_STALL_TIMEOUT_MS);

        navigation.complete.finally(() => {
            window.clearTimeout(timer);
            try {
                const raw = sessionStorage.getItem(NAVIGATION_RECOVERY_KEY);
                if (!raw) return;
                const prev = JSON.parse(raw) as { url?: string };
                if (prev.url === targetUrl) {
                    sessionStorage.removeItem(NAVIGATION_RECOVERY_KEY);
                }
            } catch {
                // noop
            }
        });
    });

    // PIPA: Microsoft Clarity 세션 리플레이 제외 경로.
    // 쪽지·설정(내 정보)·결제·본인인증·가입 등 개인정보가 노출되는 화면은 녹화하지 않는다.
    // (Clarity 기본 텍스트/입력 마스킹은 대시보드에서 유지. 여기서는 아예 recording 을 멈춘다.)
    const CLARITY_EXCLUDED_PREFIXES = [
        '/messages', // 쪽지
        '/my', // 내 설정·활동
        '/notifications', // 알림(쪽지 미리보기 포함)
        '/checkout', // 결제
        '/cart', // 장바구니
        '/point', // 포인트/결제
        '/ad-free', // 광고 제거 결제
        '/password-reset', // 비밀번호 재설정
        '/register', // 회원가입(개인정보 입력)
        '/cert', // 본인인증
        '/login' // 로그인(비밀번호 입력)
    ];

    function isClarityExcluded(pathname: string) {
        return CLARITY_EXCLUDED_PREFIXES.some(
            (p) => pathname === p || pathname.startsWith(p + '/')
        );
    }

    /**
     * ⛔ **이미 돌고 있는데 또 `start` 하면 Clarity 가 태그를 다시 붙인다.**
     *    콘솔에 `Error CL001: Multiple Clarity tags detected` 가 페이지 이동마다 찍혔다
     *    (2026-08-24 실사용자 콘솔 로그에서 확인). 이전 코드는 afterNavigate 마다
     *    조건 없이 `clarity('start')` 를 불렀다.
     *    → **상태가 바뀔 때만** 부른다.
     *
     * ⛔ 초기값은 app.html 인라인 스크립트와 **정확히 같은 규칙**으로 정해야 한다.
     *    거기서는 최초 경로가 제외 목록에 있으면 `clarity('stop')` 을 부른다.
     *    초기값을 틀리면 두 방향 다 사고다 —
     *      · 켜야 할 곳에서 꺼진 채 남으면 데이터 유실
     *      · **꺼야 할 곳에서 켜진 채 남으면 PIPA 위반**(쪽지·결제 화면 녹화)
     *    그래서 "모른다" 가 아니라 최초 경로로 계산해서 맞춘다.
     */
    let clarityStopped = browser ? isClarityExcluded(location.pathname) : false;

    function applyClarityPrivacyGuard(pathname: string) {
        if (!browser) return;
        const clarity = (window as unknown as { clarity?: (...args: unknown[]) => void }).clarity;
        if (typeof clarity !== 'function') return;
        const excluded = isClarityExcluded(pathname);
        if (excluded === clarityStopped) return; // 이미 그 상태다 — 중복 호출 금지
        // 스니펫 stub 이 큐잉하므로 실제 스크립트 로드 전 호출도 순서대로 반영된다.
        clarity(excluded ? 'stop' : 'start');
        clarityStopped = excluded;
    }

    // afterNavigate 통합: GA4 페이지뷰 + 광고 observer 재설정
    afterNavigate(({ to }) => {
        // GA4 페이지뷰 추적
        if (to?.url) {
            // PIPA: 민감 페이지는 Clarity 리플레이 제외 (SPA 라우팅마다 재평가)
            applyClarityPrivacyGuard(to.url.pathname);

            trackPageView(to.url.pathname + to.url.search);
            consumePendingAuthEvent();
            updatePageTargeting(to.url.pathname);

            // audit P3 (5/22 미팅 직결): 홈/게시판 진입 시 1회 adblock 감지
            // path 단위 dedupe (ad-telemetry.ts 내부) → 같은 페이지 재진입 시 재송신 X
            const ctx = resolvePageContext(to.url.pathname);
            if (ctx.pageType === 'home' || ctx.pageType === 'board_list') {
                detectAdblockOnce(ctx.pageType, ctx.boardId);
            }
        }
        // 광고 observer 재설정 (기존 observer 재활용, 새 광고만 추가 observe)
        untrack(() => {
            if (!aplogMod) return;
            requestAnimationFrame(() => {
                aplogMod!.reinitAplog(authStore.user?.mb_id ?? null);
            });
        });
    });

    // 현재 활성 플러그인
    const activePlugins = $derived(pluginStore.state.activePlugins);

    // SSR 시점에 즉시 레이아웃 결정 (eager import로 동적 로딩 없음)
    // - 빌드 타임에 모든 테마 레이아웃이 번들에 포함됨
    // - LCP/FCP 개선, invisible 대기 시간 0ms
    const ThemeLayout = $derived(getThemeLayout(data.activeTheme));

    // 테마 Hook 및 Component 로드 (변경 시에만)
    let prevThemeId = '';
    $effect(() => {
        const theme = data.activeTheme;
        if (theme && theme !== prevThemeId) {
            prevThemeId = theme;
            loadThemeHooks(theme);
            loadThemeComponents(theme);
        }
    });

    // activePlugins 변경 시 플러그인 Hook 및 Component 로드 (ID 변경 시에만)
    let prevPluginIds = '';
    $effect(() => {
        const plugins = activePlugins;
        const pluginIds = plugins.map((p) => p.id).join(',');
        if (plugins.length > 0 && pluginIds !== prevPluginIds) {
            prevPluginIds = pluginIds;
            // 플러그인 Hook 로드 후 액션 실행
            loadAllPluginHooks(
                plugins.map((p) => ({
                    id: p.id,
                    manifest: {
                        id: p.id,
                        name: p.name,
                        version: p.version,
                        author: { name: 'Unknown' },
                        hooks: p.hooks,
                        components: p.components
                    }
                }))
            ).then(() => {
                try {
                    doAction('board.layout.register');
                } catch (err) {
                    console.error('[layout] board.layout.register hook error:', err);
                }
            });

            // 플러그인 Component 로드
            loadAllPluginComponents(
                plugins.map((p) => ({
                    id: p.id,
                    manifest: {
                        id: p.id,
                        name: p.name,
                        version: p.version,
                        author: { name: 'Unknown' },
                        hooks: p.hooks,
                        components: p.components
                    }
                }))
            );
        }
    });

    // ⛔ **초기 1회는 여기서 — $effect 는 서버에서 실행되지 않는다.**
    //    이 시드가 $effect 안에만 있어서 SSR 시점의 스토어가 항상 비어 있었고,
    //    마음메시지 위젯이 서버 HTML 에 아무것도 못 그렸다(높이 0). 하이드레이션 직후
    //    81px 이 생기며 아래 위젯과 footer 를 밀었다 — 2026-08-20 실측.
    //    같은 계열의 선례: 사이드바 아코디언(#2151)·메뉴 데이터(2026-08-12).
    // ⚠️ 컴파일러가 state_referenced_locally 경고를 낸다 — **의도한 것이다.**
    //    초기값만 읽고, 이후 변경은 아래 $effect 가 맡는다. (CI 는 --threshold error)
    untrack(() => {
        initAppData({ celebration: data.celebration || [], banners: data.banners || {} });
        initCelebrationFromData(data.celebration || []);
    });

    // 이후 네비게이션에서 데이터가 바뀌면 갱신한다.
    // 첫 렌더분은 위에서 이미 처리했으므로 여기서는 값이 바뀌지 않는다.
    $effect(() => {
        const celebration = data.celebration;
        const banners = data.banners;
        untrack(() => {
            initAppData({ celebration: celebration || [], banners: banners || {} });
            // 빈 배열도 ready 상태로 초기화해야 모든 위치에서 fallback 문구가 즉시 보인다.
            initCelebrationFromData(celebration || []);
        });
    });

    // 기본 슬롯은 SSR 시점부터 등록되어야 상단 배너/롤링이 하이드레이션 뒤 늦게 뜨지 않는다.
    registerDefaultSlots();

    function readLayoutInitCache(): LayoutInitPayload | null {
        if (!browser) return null;

        try {
            const raw = sessionStorage.getItem(LAYOUT_INIT_STORAGE_KEY);
            if (!raw) return null;

            const parsed = JSON.parse(raw) as { expiresAt: number; data: LayoutInitPayload };
            if (!parsed?.data || parsed.expiresAt <= Date.now()) {
                sessionStorage.removeItem(LAYOUT_INIT_STORAGE_KEY);
                return null;
            }

            return parsed.data;
        } catch {
            return null;
        }
    }

    function writeLayoutInitCache(data: LayoutInitPayload) {
        if (!browser) return;

        try {
            sessionStorage.setItem(
                LAYOUT_INIT_STORAGE_KEY,
                JSON.stringify({
                    expiresAt: Date.now() + LAYOUT_INIT_STORAGE_TTL_MS,
                    data
                })
            );
        } catch {
            // ignore
        }
    }

    function applyLayoutInitPayload(initData: LayoutInitPayload) {
        if (initData.celebration?.length || initData.banners) {
            initAppData({
                celebration: initData.celebration || [],
                banners: initData.banners || {}
            });
            initCelebrationFromData(initData.celebration || []);
        }
        if (initData.activePlugins?.length) {
            pluginStore.initFromServer(initData.activePlugins);
        }
        if (initData.ga4MeasurementId) {
            initGA4(initData.ga4MeasurementId);
            consumePendingAuthEvent();
        }
    }

    // #12971: 세션 만료(access+refresh 양 토큰 만료) 시 UI가 로그인 상태로 남아
    // 닉네임은 보이는데 작성은 실패하는 stale 상태를 방지한다. client.ts 가 refresh
    // 실패 시 'auth:session-expired' 를 전파하면, auth 상태를 정리(닉네임 제거)하고
    // 재로그인을 안내한다. (이미 로그아웃 상태면 중복 안내하지 않음)
    $effect(() => {
        if (!browser) return;
        const handleSessionExpired = () => {
            if (!authStore.isAuthenticated) return;
            authActions.resetAuth();
            toast.error('세션이 만료되어 로그아웃되었습니다. 다시 로그인해 주세요.');
        };
        window.addEventListener('auth:session-expired', handleSessionExpired);
        return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
    });

    // 하이드레이션 앵커 관측용 서명 헬퍼 (2026-08-19).
    // ⛔ 실패한 로드만 보면 아무것도 못 가른다 — 정상 로드에서도 스크립트는 붙고
    //    광고도 붙는다. 실제로 첫 배포(#2129) 데이터에서 광고 인과 가설이
    //    "광고 없이 실패 91건 / 있고 실패 102건" 으로 기각됐다.
    //    그래서 **성공 로드도 1% 표본으로 같은 서명을 보낸다.** 분포를 비교해야
    //    실패에 특이한 신호가 무엇인지 갈린다.
    const ANCHOR_OK_SAMPLE_RATE = 0.01;

    function bodySigNow(): string {
        try {
            const kids = Array.from(document.body.children).slice(0, 14);
            const parts = kids.map((e) => {
                let t = e.tagName.toLowerCase();
                if (e.id) t += `#${e.id}`;
                else if (typeof e.className === 'string' && e.className)
                    t += `.${e.className.split(' ')[0]}`;
                return t;
            });
            const extra = document.body.children.length - kids.length;
            if (extra > 0) parts.push(`+${extra}`);
            return parts.join(',');
        } catch {
            return '(sig-failed)';
        }
    }

    function targetSigNow(): string {
        try {
            // ⛔ app.html 과 **같은 방식**으로 앱 루트를 찾아야 한다. 한쪽만 고치면
            //    pre/post 서명이 서로 다른 요소를 보게 돼 tsame 이 무의미해진다.
            const el = document.getElementById('app-root') ?? document.body.firstElementChild;
            if (!el) return '(no-target)';
            const out: string[] = [];
            let n = el.firstChild;
            let i = 0;
            for (; n && i < 12; n = n.nextSibling, i++) {
                if (n.nodeType === 8) out.push(`#${String((n as Comment).data).slice(0, 3)}`);
                else if (n.nodeType === 3) out.push('t');
                else if (n.nodeType === 1) {
                    const e = n as Element;
                    out.push(e.id ? `${e.tagName.toLowerCase()}#${e.id}` : e.tagName.toLowerCase());
                }
            }
            if (n) out.push('+');
            return out.join(',');
        } catch {
            return '(sig-failed)';
        }
    }

    // ⛔ 광고 노드는 **문서 전체**에서 세야 한다. body 직계 자식만 보면
    //    앱 div 안에 꽂히는 인피드 광고를 통째로 놓친다 — 실제로 그래서 2026-08-19 에
    //    "광고 없이도 실패 91건" 이라는 잘못된 기각 판정을 냈다.
    //    ok(대조군) 대비로 비교해야 의미가 있다.
    /** app.html 이 모은 하이드레이션 전 DOM 변형 요약. 없으면 빈 값. */
    function mutSig(): string {
        try {
            const w = window as unknown as Record<string, unknown>;
            const get = w.__angpleMut;
            // ⛔ 관찰자가 아예 안 붙은 것과 "변형 0건"은 다르다. 섞으면 대조군이 거짓말한다.
            if (typeof get !== 'function') return 'off';
            const r = (get as () => { n: number; b: number; list: string[] })();
            // 경계 두 개를 병기한다.
            //   b = 번들 모듈 평가 시각(하이드레이션보다 앞이지만 청크 평가 시간만큼 헐겁다)
            //   h = 루트 컴포넌트가 실제로 하이드레이션되는 시각 — 이쪽이 진짜 경계다
            // 둘의 차이가 곧 "경계가 얼마나 헐거웠나"를 알려주는 자기 진단이 된다.
            const b = `@${String(w.__angpleBundleAt ?? '?')}/${String(w.__angpleHydrateAt ?? '?')}`;
            // ⭐ b = 하이드레이션 **전** 변형 수 = 외부가 건드린 횟수.
            //    이게 이 계측의 핵심 질문에 대한 답이다. n(총합)에는 실패 시 Svelte 자신의
            //    폐기 동작이 섞이므로, n 만으로는 "외부가 몇 번 건드렸나"를 알 수 없다.
            if (r.n === 0) return `${b}|n=0,b=0`;
            return `${b}|n=${r.n},b=${r.b}|${r.list.join(',')}`.slice(0, 200);
        } catch {
            return '?';
        }
    }

    function adCounts(): string {
        try {
            const all = document.querySelectorAll('ins.adsbygoogle, iframe[id^="aswift"]').length;
            const root = document.getElementById('app-root') ?? document.body.firstElementChild;
            const inRoot = root
                ? root.querySelectorAll('ins.adsbygoogle, iframe[id^="aswift"]').length
                : -1;
            return `${all}/${inRoot}`;
        } catch {
            return '?/?';
        }
    }

    // 내비게이션 유형(navigate/reload/back_forward)과 가시성.
    // ⛔ 새 필드를 만들지 않는다 — 수집기가 스키마 밖 필드를 버린다. stack 에 싣는다.
    function navType(): string {
        try {
            const nav = performance.getEntriesByType('navigation')[0] as
                | PerformanceNavigationTiming
                | undefined;
            return `${nav?.type ?? '?'}/${document.visibilityState}`;
        } catch {
            return '?/?';
        }
    }

    function buildAnchorStack(
        sigPre: string,
        sigNow: string,
        tgtPre: string,
        tgtNow: string
    ): string {
        return [
            `at=${Math.round(performance.now())}ms`,
            '(anchor-context)',
            `pre=${sigPre}`,
            `post=${sigNow}`,
            `same=${sigPre === sigNow}`,
            `tpre=${tgtPre}`,
            `tpost=${tgtNow}`,
            `tsame=${tgtPre === tgtNow}`,
            `ads=${adCounts()}`,
            // ⛔ nav= 를 **신규 장문 필드보다 앞**에 둔다. stack 은 뒤에서 잘리는데,
            //    가장 값싼 판별자가 제일 먼저 죽으면 안 된다.
            `nav=${navType()}`,
            // 하이드레이션 전 DOM 신호 (app.html 이 파싱 직후 채운다).
            // dcnt/dsig: #app-root 서브트리의 요소 수와 태그열 해시.
            //   ⭐ **같은 글(URL)** 의 실패 로드와 성공 로드에서 이 둘이 다르면 하이드레이션
            //      전에 이미 DOM 이 달라진 것이다. 같으면 원인은 클라이언트 타이밍 쪽이다.
            // mut=: 파싱 후 ~ 하이드레이션 사이에 관찰된 childList 변형(최대 5건).
            String((window as unknown as Record<string, unknown>).__angpleDeep ?? 'dcnt=?'),
            // ⛔ 내비게이션 유형이 다음 판별자 후보다.
            //    Playwright WebKit 으로 신선 로드·항해를 24회 돌려도 실패율 0% 였는데
            //    운영 iOS 사파리는 ~50~68% 다(비로그인 포함). 차이가 뭔지 좁혀야 한다.
            //    `back_forward` = bfcache 복원 — app.html 의 iOS 전용 reload 스크립트가
            //    발화하는 바로 그 경로이고, Playwright 의 goBack 은 이걸 재현하지 못한다.
            `mut=${mutSig()}`
        ]
            .join('\n')
            .slice(0, 1500);
    }

    onMount(() => {
        // ⛔ 하이드레이션 전 DOM 관찰자를 **가장 먼저** 끊는다.
        //    여기는 하이드레이션이 끝난 뒤다. 더 두면 앱이 정상적으로 만드는 변형까지
        //    기록되어 5칸이 채워지고, 정작 원인인 초기 변형이 밀려난다.
        //    ⭐ 아래 앵커 판정이 어느 분기로 가든(detached/missing/ok/무판정) 이미 해제된다.
        try {
            const stop = (window as unknown as Record<string, unknown>).__angpleMutStop;
            if (typeof stop === 'function') (stop as () => void)();
        } catch {
            /* 관측용 */
        }

        // 읽음 표시 전환 재개 — app.html 이 첫 페인트 전에 건 .hydrating 을 뗀다.
        // ⛔ 프레임을 두 번 넘긴 뒤에 뗀다. 하이드레이션이 클래스를 바꾸는 그 프레임에
        //    전환이 살아 있으면 0.8초짜리 색 변화가 그대로 보인다 — 끄는 의미가 없어진다.
        //    (두 번인 이유: 첫 rAF 는 아직 그 프레임, 두 번째가 페인트 이후다)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.documentElement.classList.remove('hydrating');
            });
        });

        // 하이드레이션 앵커 판정 — 로그 없는 실패 경로 포착 (app.html 의 앵커 캡처와 한 쌍)
        //
        // Svelte 가 HYDRATION_START 주석을 못 찾으면 throw HYDRATION_ERROR 로 빠지는데,
        // 그 경로는 console 출력이 아예 없어서(render.js:134) warn 후킹으로도 안 잡힌다.
        // 하이드레이션이 폐기되면 clear_text_content(target) 가 자식 노드를 전부 떼어내므로,
        // 붙잡아 둔 앵커의 isConnected 로 확정 판정할 수 있다.
        // 마운트 1회만 검사하고 참조는 즉시 버린다(노드 누수 방지).
        try {
            const w = window as unknown as Record<string, unknown>;
            if ('__angpleHydrationAnchor' in w) {
                const anchor = w.__angpleHydrationAnchor as Comment | null;
                const reason =
                    anchor === null
                        ? 'anchor_missing' // SSR 마커가 처음부터 없음 (확장이 제거한 경우 등)
                        : !anchor.isConnected
                          ? 'anchor_detached' // 하이드레이션 폐기 후 CSR 재마운트됨
                          : null;
                if (reason) {
                    // ⛔ 여기서 Error 를 만들어 스택을 떠도 소용없다. 이 코드는 onMount,
                    //    즉 하이드레이션이 이미 폐기된 **뒤**라 onMount 의 스택만 나온다.
                    //    원인 지점은 그보다 앞에서 이미 지나갔다.
                    //
                    //    그래서 스택 대신 **DOM 서명 전후 비교**를 싣는다. app.html 이
                    //    하이드레이션 직전에 body 자식 서명을 남겨두므로, 지금 다시 떠서
                    //    비교하면 그 사이에 노드가 끼어들었는지 데이터로 갈린다
                    //    (광고 스크립트·브라우저 확장·번역기 주입 가설의 직접 검증).
                    //
                    //    ⛔ 수집기는 스키마에 없는 필드를 버린다(js_errors 컬럼 고정).
                    //       그래서 부가 정보는 새 필드가 아니라 stack 에 실어 보낸다.
                    const sigNow = bodySigNow();
                    const tgtNow = targetSigNow();
                    const sigPre = String(w.__angpleBodySig ?? '(none)');
                    const tgtPre = String(w.__angpleTargetSig ?? '(none)');
                    const stack = buildAnchorStack(sigPre, sigNow, tgtPre, tgtNow);
                    fetch('https://aplog.damoang.net/api/v1/dantry', {
                        mode: 'cors',
                        credentials: 'include',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'hydration_error',
                            reason,
                            channel: 'anchor',
                            message: `hydration anchor ${reason}`,
                            stack,
                            url: window.location.href,
                            userAgent: navigator.userAgent
                        })
                    }).catch(() => {});
                } else if (Math.random() < ANCHOR_OK_SAMPLE_RATE) {
                    // 대조군 — 성공 로드 1% 표본. 실패 분포와 비교할 기준선이다.
                    // ⛔ 이게 없으면 "실패 시 이렇더라"만 알 뿐 정상과 구분이 안 된다.
                    const sigPre = String(w.__angpleBodySig ?? '(none)');
                    const tgtPre = String(w.__angpleTargetSig ?? '(none)');
                    fetch('https://aplog.damoang.net/api/v1/dantry', {
                        mode: 'cors',
                        credentials: 'include',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'hydration_error',
                            reason: 'anchor_ok',
                            channel: 'anchor',
                            message: 'hydration anchor anchor_ok',
                            stack: buildAnchorStack(sigPre, bodySigNow(), tgtPre, targetSigNow()),
                            url: window.location.href,
                            userAgent: navigator.userAgent
                        })
                    }).catch(() => {});
                }
                delete w.__angpleHydrationAnchor;
                // 서명도 함께 버린다 — 참조를 남기면 노드 누수와 같은 종류의 낭비다.
                delete w.__angpleBodySig;
                delete w.__angpleTargetSig;
                delete w.__angpleDeep;
                delete w.__angpleMut;
            }
        } catch {
            // 관측용이라 실패해도 무시
        }

        // 디바이스 핑거프린트 수집은 상단 $effect(로그인 확정 후 발화)로 이관.
        // (onMount 는 auth 하이드레이션 전이라 isAuthenticated=false → 스킵되던 문제)

        // read-set / UI 설정의 서버 병합은 위쪽 $effect 로 옮겼다.
        // onMount 는 auth 하이드레이션 전이라 isAuthenticated 가 항상 false 였고,
        // 그래서 두 fetch 가 운영에서 한 번도 발화하지 않았다(GET 실측 0건).
        // ⛔ 여기로 되돌리지 말 것.

        const cachedMenus = readCachedMenus();
        if (cachedMenus) {
            menuStore.initFromServer(cachedMenus);
        }

        if ((data.menus?.length ?? 0) === 0 && !cachedMenus) {
            fetch('/api/layout/menus', {
                headers: { accept: 'application/json' }
            })
                .then((res) => (res.ok ? res.json() : null))
                .then((payload: { menus?: MenuItem[] } | null) => {
                    if (!payload) return;
                    const menus = Array.isArray(payload.menus) ? payload.menus : [];
                    if (menus.length === 0) return;
                    menuStore.initFromServer(menus);
                    writeCachedMenus(menus);
                })
                .catch(() => {
                    // 메뉴 로드 실패해도 기존 네비게이션은 유지
                });
        }

        // 플러그인 hooks/components 지연 로드 (SSR에서는 hooks 빈 배열로 전달하여 __data.json 축소)
        // Option C 3단계: activePlugins 는 CDN 캐시(layout/hooks·layout/init)에서 분리하고
        // no-store 인 /api/plugins/active 에서 직접 가져온다 → admin 토글 즉시 반영.
        if ((data.activePlugins?.length ?? 0) > 0) {
            fetch('/api/plugins/active')
                .then((res) => (res.ok ? res.json() : null))
                .then((payload: { plugins?: typeof data.activePlugins } | null) => {
                    if (!payload?.plugins?.length) return;
                    pluginStore.initFromServer(payload.plugins);
                })
                .catch(() => {});
        }

        // 부분 layout 데이터 로드 (banners, celebration, plugins, GA4)
        // SSR payload에서 분리하여 __data.json 바이트 절감
        const cachedLayoutInit = readLayoutInitCache();
        if (cachedLayoutInit) {
            applyLayoutInitPayload(cachedLayoutInit);
        } else {
            fetch('/api/layout/init')
                .then((res) => (res.ok ? res.json() : null))
                .then((initData) => {
                    if (!initData) return;
                    writeLayoutInitCache(initData);
                    applyLayoutInitPayload(initData);
                })
                .catch(() => {
                    // layout init 실패해도 사이트 동작에 영향 없음
                });
        }

        // GA4 초기화 (SSR fallback — layout/init 전에 이미 설정된 경우)
        if (data.ga4MeasurementId) {
            initGA4(data.ga4MeasurementId);
            consumePendingAuthEvent();
        }

        updatePageTargeting(window.location.pathname);

        // 실사용자 Core Web Vitals(CLS/LCP/INP + 범인 요소) → GA4. 유휴 후처리라 성능 영향 0.
        initWebVitalsRum();

        // Built-in Hooks 초기화 (콘텐츠 임베딩, 게시판 필터 등)
        initBuiltinHooks();

        // 인증 상태 초기화
        if (data.user) {
            // SSR에서 user 전달됨 (SSR_STRIP_USER=false 또는 미설정)
            syncAuth(data);
            authInitialized = true;
            if (authStore.isAuthenticated) blockedUsersStore.load();
        } else {
            // SSR에서 user 없음 (SSR_STRIP_USER=true 또는 비로그인)

            // Phase C: user_basic 쿠키 (JS-readable) 우선 시도
            // PUBLIC_USER_BASIC_CLIENT_READ=true 활성화 시 /api/auth/me fetch 생략
            let fastPathApplied = false;
            if (env.PUBLIC_USER_BASIC_CLIENT_READ === 'true') {
                try {
                    const basic = readUserBasicFromCookie(document.cookie);
                    // #12789 incident: 쿠키에 실명인증 여부(certified)가 없으면 fast-path 가
                    // mb_certify='' 로 렌더해 인증 유저를 미인증으로 오판 → 공감·글쓰기가
                    // 실명인증으로 잘못 유도된다. certified 를 담은 쿠키만 fast-path 로 신뢰하고,
                    // 레거시 쿠키(certified=undefined)는 /api/auth/me 로 폴백해 진실을 조회한다.
                    if (basic && basic.certified !== undefined) {
                        syncAuth({
                            ...data,
                            user: {
                                id: basic.id,
                                nickname: basic.nickname,
                                level: basic.mb_level,
                                as_level: basic.as_level,
                                mb_certify: basic.certified ? 'Y' : '',
                                mb_image: basic.mb_image ?? undefined,
                                mb_image_updated_at: basic.mb_image_updated_at ?? undefined,
                                advertiser_end_date: undefined,
                                advertiser_status: undefined
                            }
                        });
                        blockedUsersStore.load();
                        authInitialized = true;
                        fastPathApplied = true;
                    }
                } catch {
                    // cookie parse 실패 시 /api/auth/me fallback
                }
            }

            if (!fastPathApplied) {
                // 전통 경로: HttpOnly 세션 쿠키로 /api/auth/me fetch
                fetch('/api/auth/me', { credentials: 'same-origin' })
                    .then((res) => (res.ok ? res.json() : null))
                    .then((meData) => {
                        if (meData?.user) {
                            syncAuth({ ...data, ...meData });
                            blockedUsersStore.load();
                        } else {
                            authActions.initAuth();
                        }
                        authInitialized = true;
                    })
                    .catch(() => {
                        authActions.initAuth();
                        authInitialized = true;
                    });
            }
        }

        // postMessage 리스너 (Admin에서 테마 변경 시 리로드)
        function handleMessage(event: MessageEvent) {
            if (!event.origin.includes('localhost')) return;
            if (event.data?.type === 'reload-theme') {
                themeStore.loadActiveTheme();
            }
        }

        window.addEventListener('message', handleMessage);

        // visibilitychange 리스너 (탭 전환 시 테마 변경 자동 감지)
        let lastThemeCheckTimestamp = 0;

        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                try {
                    const cookies = document.cookie.split(';');
                    const triggerCookie = cookies.find((c) =>
                        c.trim().startsWith('theme-reload-trigger=')
                    );
                    if (triggerCookie) {
                        const value = triggerCookie.split('=')[1];
                        const [, timestampStr] = value.split(':');
                        const timestamp = parseInt(timestampStr, 10);
                        if (timestamp > lastThemeCheckTimestamp) {
                            themeStore.loadActiveTheme();
                            lastThemeCheckTimestamp = timestamp;
                        }
                    }
                } catch {
                    // 테마 변경 감지 실패 - 무시
                }
            }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 지연 로딩: 키보드 단축키, 즐겨찾기, 광고 추적, UI 컴포넌트
        Promise.all([
            import('$lib/services/keyboard-shortcuts.svelte'),
            import('$lib/stores/board-favorites.svelte'),
            import('$lib/services/aplog'),
            import('$lib/components/ui/sonner'),
            import('$lib/components/features/shortcut-buttons')
        ]).then(([kbMod, bfMod, apMod, toasterMod, shortcutBtnMod]) => {
            keyboardShortcutsMod = kbMod;
            boardFavoritesMod = bfMod;
            aplogMod = apMod;
            LazyToaster = toasterMod.Toaster;
            LazyShortcutButtons = shortcutBtnMod.ShortcutButtons;
            apMod.initAplog(authStore.user?.mb_id ?? null);
        });

        return () => {
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            aplogMod?.destroyAplog();
        };
    });
</script>

<svelte:window
    onkeydown={(e) => {
        if (uiSettingsStore.enableKeyboardShortcuts) {
            keyboardShortcutsMod?.keyboardShortcuts.handleKeydown(e);
        }
    }}
/>

<svelte:head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Phase 1 (Path D′): data.site 가 있으면 site-resolver 의 SEO 메타 사용. 없으면 기본 favicon. -->
    {#if data.site?.favicon_url}
        <link rel="icon" href={data.site.favicon_url} />
    {:else}
        <link rel="icon" href={favicon} />
    {/if}
    <!--
        og:title / og:description / og:image 는 페이지별 <SeoHead> (lib/seo) 가 단독 emit 한다.
        과거 여기서 data.site 기본 OG 를 함께 내보내 글 페이지에 og:title·og:description 가
        2개씩 렌더 → 카톡/페북 크롤러(first-wins)가 글 제목 대신 사이트명을 가져가던 회귀(#12699).
        site 기본 description 은 SeoHead 미사용 유틸 페이지용으로만 남긴다.
        일반 description 도 같은 first-wins 문제: SeoHead 라우트에서 함께 내보내면 태그가
        2개가 되어 Google 이 이 기본값(사이트 슬로건)을 채택 → 전 게시판/글이 동일 description
        으로 집계(중복 메타, CTR 손실). SeoHead 를 렌더하는 라우트에서는 여기서 내보내지 않는다.
    -->
    {#if data.site?.description && !routeHasSeoHead}
        <meta name="description" content={data.site.description} />
    {/if}
    {#if data.site?.keywords?.length}
        <meta name="keywords" content={data.site.keywords.join(', ')} />
    {/if}
</svelte:head>

<!-- 플러그인 슬롯: <body> 시작 (analytics, 모달 마운트 등) — Slot Catalog Sprint 2 -->
<PluginSlot name="body-start" />

<!-- /admin, /install 경로는 테마 레이아웃 없이 렌더링 -->
{#if isAdminRoute || isInstallRoute}
    {@render children()}
{:else if ThemeLayout}
    <!-- SSR 시점에 즉시 테마 레이아웃 렌더링 (동적 로딩 없음) -->
    {#key data.activeTheme}
        <ThemeLayout>
            {@render children()}
        </ThemeLayout>
    {/key}
{:else}
    <!-- 테마 레이아웃 없음: 기본 레이아웃으로 콘텐츠 렌더링 -->
    <DefaultLayout>
        {@render children()}
    </DefaultLayout>
{/if}

<!-- 회원 메모 모달 (글로벌 1개) -->
{#if pluginStore.isPluginActive('member-memo') && MemoModal}
    <MemoModal />
{/if}

<!-- 토스트 알림 (지연 로딩) -->
{#if LazyToaster}
    <LazyToaster />
{/if}

<!-- 단축 버튼 (지연 로딩, admin/install 제외) -->
{#if !isAdminRoute && !isInstallRoute && LazyShortcutButtons}
    <LazyShortcutButtons />
{/if}

<!-- AdBlock 감지 시 안내 토스트 (admin/install 제외) -->
{#if !isAdminRoute && !isInstallRoute}
    <AdblockNotice />
{/if}

<!-- 플러그인 슬롯: </body> 직전 (지연 로딩 컴포넌트, fallback 등) — Slot Catalog Sprint 2 -->
<PluginSlot name="body-end" />
