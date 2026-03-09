<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount, untrack } from 'svelte';
    import type { Component } from 'svelte';
    import { afterNavigate, onNavigate } from '$app/navigation';
    import { navigating } from '$app/state';
    import { page, updated } from '$app/stores';
    import { configureSeo } from '$lib/seo';
    import { authActions, authStore } from '$lib/stores/auth.svelte';
    import { themeStore } from '$lib/stores/theme.svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
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
    import { initGA4, trackPageView } from '$lib/services/ga4';

    // 커스터마이저 패널 (관리자 전용, 지연 로딩)
    let LazyAdminCustomizer: Component | null = $state(null);

    // 지연 로딩 모듈 참조
    let keyboardShortcutsMod: typeof import('$lib/services/keyboard-shortcuts.svelte') | null =
        $state(null);
    let boardFavoritesMod: typeof import('$lib/stores/board-favorites.svelte') | null =
        $state(null);
    let aplogMod: typeof import('$lib/services/aplog') | null = $state(null);
    let LazyToaster: Component | null = $state(null);
    let LazyShortcutButtons: Component | null = $state(null);

    const { children, data } = $props(); // Svelte 5: SSR 데이터 받기

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

    configureSeo({
        siteName: import.meta.env.VITE_SITE_NAME || 'Angple',
        siteUrl
    });

    // SSR에서 받은 테마/플러그인/메뉴로 스토어 초기화 (깜박임 방지!)
    $effect(() => {
        const theme = data.activeTheme;
        const plugins = data.activePlugins || [];
        const menus = data.menus || [];
        untrack(() => {
            themeStore.initFromServer(theme);
            pluginStore.initFromServer(plugins);
            menuStore.initFromServer(menus);
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

    // 네비게이션 프로그레스바 (300ms 딜레이 — 빠른 전환에서는 숨김)
    let showNavProgress = $state(false);
    let navProgressTimeout: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        clearTimeout(navProgressTimeout);
        if (navigating.to) {
            navProgressTimeout = setTimeout(() => {
                showNavProgress = true;
            }, 300);
        } else {
            showNavProgress = false;
        }
    });

    // View Transitions API — 부드러운 페이지 전환 (지원 브라우저에서만, 모션 감소 설정 존중)
    onNavigate((navigation) => {
        if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches)
            return;
        return new Promise((resolve) => {
            document.startViewTransition(async () => {
                resolve();
                await navigation.complete;
            });
        });
    });

    // 새 버전 감지 시 다음 네비게이션에서 풀 리로드 (최대 2회, 무한 루프 방지)
    const UPDATED_RELOAD_KEY = '__angple_updated_reload__';
    afterNavigate(({ type }) => {
        if ($updated && type !== 'enter') {
            const count = Number(sessionStorage.getItem(UPDATED_RELOAD_KEY) || '0');
            if (count < 2) {
                sessionStorage.setItem(UPDATED_RELOAD_KEY, String(count + 1));
                location.reload();
            }
        }
    });

    // GA4: SPA 네비게이션 시 페이지뷰 추적
    afterNavigate(({ to }) => {
        if (to?.url) {
            trackPageView(to.url.pathname + to.url.search);
        }
    });

    // 광고 추적: 매 네비게이션마다 observer 재설정 (aplog 모듈 로드 후)
    afterNavigate(() => {
        untrack(() => {
            if (!aplogMod) return;
            aplogMod.destroyAplog();
            requestAnimationFrame(() => {
                aplogMod!.initAplog(authStore.user?.mb_id ?? null);
            });
        });
    });

    // 현재 활성 플러그인
    const activePlugins = $derived(pluginStore.state.activePlugins);

    // SSR 시점에 즉시 레이아웃 결정 (eager import로 동적 로딩 없음)
    // - 빌드 타임에 모든 테마 레이아웃이 번들에 포함됨
    // - LCP/FCP 개선, invisible 대기 시간 0ms
    const ThemeLayout = $derived(getThemeLayout(data.activeTheme));

    // 테마 Hook 및 Component 로드 (레이아웃과 별개로 동작)
    $effect(() => {
        const theme = data.activeTheme;
        if (theme) {
            loadThemeHooks(theme);
            loadThemeComponents(theme);
        }
    });

    // activePlugins 변경 시 플러그인 Hook 및 Component 로드
    $effect(() => {
        if (activePlugins.length > 0) {
            // 플러그인 Hook 로드 후 액션 실행
            loadAllPluginHooks(
                activePlugins.map((p) => ({
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
                doAction('board.layout.register');
            });

            // 플러그인 Component 로드
            loadAllPluginComponents(
                activePlugins.map((p) => ({
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
            if (celebration && celebration.length > 0) {
                initCelebrationFromData(celebration);
            }
        });
    });

    onMount(() => {
        // GA4 초기화 (Measurement ID가 설정된 경우에만)
        if (data.ga4MeasurementId) {
            initGA4(data.ga4MeasurementId);
        }

        // $updated 리로드 카운터 리셋 (정상 로드 확인 후)
        setTimeout(() => sessionStorage.removeItem(UPDATED_RELOAD_KEY), 10000);

        // Built-in Hooks 초기화 (콘텐츠 임베딩, 게시판 필터 등)
        initBuiltinHooks();

        // 슬롯 기본 컴포넌트 등록 (포크 시 slot-defaults.ts 수정으로 커스터마이징)
        registerDefaultSlots();

        // 인증 상태 초기화 (SSR에서 받은 데이터가 있으면 우선 사용)
        if (data.user && data.accessToken) {
            authActions.initFromSSR(
                { id: data.user.id, nickname: data.user.nickname ?? '', level: data.user.level },
                data.accessToken
            );
        } else {
            authActions.initAuth();
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

        // 관리자 커스터마이저 패널 (관리자일 때만 로드)
        if (data.isAdmin) {
            import('$lib/components/features/admin-customizer').then((mod) => {
                LazyAdminCustomizer = mod.AdminCustomizer;
            });
        }

        return () => {
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            aplogMod?.destroyAplog();
        };
    });
</script>

<svelte:window onkeydown={(e) => keyboardShortcutsMod?.keyboardShortcuts.handleKeydown(e)} />

<svelte:head>
    <title>{import.meta.env.VITE_SITE_NAME || '다모앙'} - 종합 커뮤니티</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
</svelte:head>

<!-- 네비게이션 프로그레스바 (300ms 이상 걸리는 전환에서만 표시) -->
{#if showNavProgress}
    <div class="nav-progress" aria-hidden="true"></div>
{/if}

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

<!-- 버그 제보 + 트래커 FAB (admin/install 제외) -->
{#if !isAdminRoute && !isInstallRoute}
    <div class="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-2">
        <a
            href="https://docs.google.com/spreadsheets/d/1zqUv_vKVqEeZhxpxrw2OVIUmUEAS8qONUUPVpNthYOU"
            target="_blank"
            rel="noopener noreferrer"
            class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-emerald-700"
            title="버그 트래커 (Google Sheets)"
        >
            <!-- FileSpreadsheet icon (inline SVG — lucide 의존성 제거) -->
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path
                    d="M14 2v4a2 2 0 0 0 2 2h4"
                /><path d="M8 13h2" /><path d="M14 13h2" /><path d="M8 17h2" /><path
                    d="M14 17h2"
                /></svg
            >
        </a>
        <a
            href="/bug"
            class="flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-all hover:scale-105 hover:bg-red-700"
            title="버그 제보"
        >
            <!-- Bug icon (inline SVG — lucide 의존성 제거) -->
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" /><path
                    d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"
                /><path
                    d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"
                /><path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path
                    d="M6 13H2"
                /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" /><path
                    d="M20.97 5c0 2.1-1.6 3.8-3.5 4"
                /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" /></svg
            >
        </a>
    </div>
{/if}

<!-- 단축 버튼 (지연 로딩, admin/install 제외) -->
{#if !isAdminRoute && !isInstallRoute && LazyShortcutButtons}
    <LazyShortcutButtons />
{/if}

<!-- 관리자 커스터마이저 패널 (지연 로딩) -->
{#if !isAdminRoute && !isInstallRoute && LazyAdminCustomizer}
    <LazyAdminCustomizer />
{/if}
