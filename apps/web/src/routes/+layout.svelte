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
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';
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
    import { AdblockNotice } from '$lib/components/features/adblock-notice';
    import type { MenuItem } from '$lib/api/types';
    import { readUserBasicFromCookie } from '$lib/utils/user-basic-client';
    import { env } from '$env/dynamic/public';

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

    // afterNavigate 통합: GA4 페이지뷰 + 광고 observer 재설정
    afterNavigate(({ to }) => {
        // GA4 페이지뷰 추적
        if (to?.url) {
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

    // SSR 데이터로 celebration + banners 캐시 초기화 (CDN 요청 제거)
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

    onMount(() => {
        // 디바이스 핑거프린트 수집 (로그인 사용자 한정, 1일 1회 throttle).
        // 기본 비활성 — PUBLIC_FINGERPRINT_ENABLED=true + 처리방침 공시·법률검토 후에만 동작.
        if (browser && authStore.isAuthenticated) void collectAndReportFingerprint();

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

        // 플러그인 hooks/components 지연 로드 (SSR에서는 빈 배열로 전달하여 __data.json 축소)
        if ((data.activePlugins?.length ?? 0) > 0) {
            fetch('/api/layout/hooks')
                .then((res) => (res.ok ? res.json() : null))
                .then((payload: { activePlugins?: typeof data.activePlugins } | null) => {
                    if (!payload?.activePlugins?.length) return;
                    pluginStore.initFromServer(payload.activePlugins);
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
                    if (basic) {
                        syncAuth({
                            ...data,
                            user: {
                                id: basic.id,
                                nickname: basic.nickname,
                                level: basic.mb_level,
                                as_level: basic.as_level,
                                mb_certify: '',
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
    -->
    {#if data.site?.description}
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
