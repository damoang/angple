<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount, untrack } from 'svelte';
    import type { Component } from 'svelte';
    import { page } from '$app/stores';
    import { configureSeo } from '$lib/seo';
    import { authActions } from '$lib/stores/auth.svelte';
    import { themeStore } from '$lib/stores/theme.svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadThemeHooks } from '$lib/hooks/theme-loader';
    import { loadThemeComponents } from '$lib/utils/theme-component-loader';
    import { loadAllPluginHooks } from '$lib/hooks/plugin-loader';
    import { loadAllPluginComponents } from '$lib/utils/plugin-component-loader';
    import { doAction } from '$lib/hooks/registry';
    import { initBuiltinHooks } from '$lib/hooks';
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';

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
    configureSeo({
        siteName: import.meta.env.VITE_SITE_NAME || 'Angple',
        siteUrl: $page.url.origin
    });

    // SSR에서 받은 테마/플러그인으로 스토어 초기화 (깜박임 방지!)
    $effect(() => {
        const theme = data.activeTheme;
        const plugins = data.activePlugins || [];
        untrack(() => {
            themeStore.initFromServer(theme);
            pluginStore.initFromServer(plugins);
        });
    });

    // 현재 활성 테마
    const activeTheme = $derived(themeStore.currentTheme.activeTheme);

    // 현재 활성 플러그인
    const activePlugins = $derived(pluginStore.state.activePlugins);

    // 동적으로 로드된 테마 레이아웃 컴포넌트
    let ThemeLayout = $state<Component | null>(null);

    // Vite의 import.meta.glob으로 모든 테마 레이아웃 패턴 정의
    // 상대 경로로 프로젝트 루트의 themes 디렉터리 참조
    // (Vite glob은 alias를 지원하지 않아 상대 경로 필수)
    const themeLayouts = import.meta.glob('../../../../themes/*/layouts/main-layout.svelte');

    /**
     * 테마 레이아웃 동적 로드
     */
    async function loadThemeLayout(themeId: string | null) {
        if (!themeId) {
            ThemeLayout = null;
            return;
        }

        try {
            // Vite glob 패턴과 일치하는 상대 경로 사용
            const layoutPath = `../../../../themes/${themeId}/layouts/main-layout.svelte`;

            // glob 패턴에 매칭되는 경로가 있는지 확인
            if (layoutPath in themeLayouts) {
                const module = (await themeLayouts[layoutPath]()) as { default: Component };
                ThemeLayout = module.default;
            } else {
                // 테마 레이아웃이 없으면 기본 레이아웃 사용
                ThemeLayout = null;
            }
        } catch (error) {
            console.error(`[Layout] 테마 레이아웃 로드 실패: ${themeId}`, error);
            ThemeLayout = null;
        }
    }

    // activeTheme 변경 시 자동으로 레이아웃, Hook, Component 로드
    $effect(() => {
        const theme = activeTheme;

        // 비동기 로드 (void로 처리하여 $effect 내 안전하게 실행)
        void loadThemeLayout(theme).catch((err) => {
            console.error('[Layout] 테마 레이아웃 로드 에러:', err);
            ThemeLayout = null;
        });

        // 테마 Hook 및 Component 로드
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

<svelte:head>
    <title>{import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
    <!-- Wanted Sans Font -->
    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/static/split/WantedSans.min.css"
    />
</svelte:head>

<!-- /admin, /install 경로는 테마 레이아웃 없이 렌더링 -->
{#if isAdminRoute || isInstallRoute}
    {@render children()}
{:else if ThemeLayout}
    <!-- 동적으로 로드된 테마 레이아웃 (Svelte 5: 컴포넌트 변수 직접 사용) -->
    <!-- {#key}로 감싸서 네비게이션 시 안정적으로 컴포넌트 교체 -->
    {#key activeTheme}
        {#if typeof ThemeLayout === 'function'}
            <ThemeLayout>
                {@render children()}
            </ThemeLayout>
        {:else}
            {@render children()}
        {/if}
    {/key}
{:else if activeTheme}
    <!-- 테마 레이아웃 로드 중 또는 SSR - children 직접 렌더링 -->
    <!-- SSR에서 $effect가 실행되지 않아 ThemeLayout이 null이므로 children 먼저 렌더링 -->
    <div class="min-h-screen bg-white">
        {@render children()}
    </div>
{:else}
    <!-- 테마 미선택 시 안내 메시지 -->
    <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div class="text-center">
            <div class="mb-4 text-6xl">🎨</div>
            <h1 class="mb-2 text-2xl font-bold text-gray-800">테마를 선택해주세요</h1>
            <p class="text-gray-600">관리자 페이지에서 테마를 활성화해주세요.</p>
        </div>
    </div>
{/if}

<!-- 회원 메모 모달 (글로벌 1개) -->
{#if pluginStore.isPluginActive('member-memo') && MemoModal}
    <MemoModal />
{/if}
