<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount, untrack } from 'svelte';
    import type { Component } from 'svelte';
    import { afterNavigate } from '$app/navigation';
    import { page } from '$app/stores';
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
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';
    import { Toaster } from '$lib/components/ui/sonner';
    import DefaultLayout from '$lib/layouts/default-layout.svelte';
    import { keyboardShortcuts } from '$lib/services/keyboard-shortcuts.svelte';
    import { initAplog, destroyAplog } from '$lib/services/aplog';
    import { getThemeLayout } from '$lib/themes/layout-registry';

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

    // 메뉴 데이터 변경 시 키보드 단축키 빌드
    $effect(() => {
        const menus = menuStore.menus;
        untrack(() => {
            keyboardShortcuts.buildFromMenus(menus);
        });
    });

    // 광고 추적: 매 네비게이션마다 observer 재설정
    afterNavigate(() => {
        destroyAplog();
        requestAnimationFrame(() => {
            initAplog(authStore.user?.mb_id ?? null);
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

    onMount(() => {
        // Built-in Hooks 초기화 (콘텐츠 임베딩, 게시판 필터 등)
        initBuiltinHooks();

        // 테마는 이미 SSR에서 로드되었으므로 loadActiveTheme() 호출 불필요
        // (깜박임 방지!)

        // 인증 상태 초기화 (SSR에서 받은 데이터가 있으면 우선 사용)
        if (data.user && data.accessToken) {
            authActions.initFromSSR(
                { nickname: data.user.nickname ?? '', level: data.user.level },
                data.accessToken
            );
        } else {
            authActions.initAuth();
        }

        // postMessage 리스너 (Admin에서 테마 변경 시 리로드)
        function handleMessage(event: MessageEvent) {
            // 보안: localhost에서만 허용
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
                    // Cookie에서 테마 변경 플래그 읽기
                    const cookies = document.cookie.split(';');
                    const triggerCookie = cookies.find((c) =>
                        c.trim().startsWith('theme-reload-trigger=')
                    );

                    if (triggerCookie) {
                        const value = triggerCookie.split('=')[1]; // "themeId:timestamp"
                        const [, timestampStr] = value.split(':');
                        const timestamp = parseInt(timestampStr, 10);

                        // 마지막 확인 이후 변경된 경우에만 리로드
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

        return () => {
            window.removeEventListener('message', handleMessage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    });
</script>

<svelte:window onkeydown={keyboardShortcuts.handleKeydown} />

<svelte:head>
    <title>{import.meta.env.VITE_SITE_NAME || '다모앙'}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
</svelte:head>

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

<!-- 토스트 알림 -->
<Toaster />
