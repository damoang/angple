<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import type { Component } from 'svelte';
    import { page } from '$app/stores';
    import { authActions } from '$lib/stores/auth.svelte';
    import { themeStore } from '$lib/stores/theme.svelte';
    import { loadThemeHooks } from '$lib/hooks/theme-loader';
    import { loadThemeComponents } from '$lib/utils/theme-component-loader';

    const { children, data } = $props(); // Svelte 5: SSR 데이터 받기

    // /admin, /install 경로 여부 확인 (테마 레이아웃 적용 안함)
    const isAdminRoute = $derived($page.url.pathname.startsWith('/admin'));
    const isInstallRoute = $derived($page.url.pathname.startsWith('/install'));

    // SSR에서 받은 테마로 스토어 초기화 (깜박임 방지!)
    themeStore.initFromServer(data.activeTheme);

    // 현재 활성 테마
    const activeTheme = $derived(themeStore.currentTheme.activeTheme);

    // 동적으로 로드된 테마 레이아웃 컴포넌트
    let ThemeLayout = $state<Component | null>(null);

    // Vite의 import.meta.glob으로 모든 테마 레이아웃 패턴 정의
    // 상대 경로로 프로젝트 루트의 themes 디렉터리 참조
    // (Vite glob은 alias를 지원하지 않아 상대 경로 필수)
    const themeLayouts = import.meta.glob([
        '../../../../themes/*/layouts/main-layout.svelte',
        '../../../../custom-themes/*/layouts/main-layout.svelte'
    ]);

    /**
     * 테마 레이아웃 동적 로드
     */
    async function loadThemeLayout(themeId: string | null) {
        console.log(`🔍 [loadThemeLayout] 호출됨 - themeId: ${themeId}`);

        if (!themeId) {
            ThemeLayout = null;
            console.log('⚠️ [loadThemeLayout] themeId가 null, 기본 레이아웃 사용');
            return;
        }

        try {
            // glob 키에서 themeId와 매칭되는 모든 경로 찾기 (themes/ 및 custom-themes/)
            const suffix = `/${themeId}/layouts/main-layout.svelte`;
            const candidates = Object.keys(themeLayouts).filter((k) => k.endsWith(suffix));
            console.log(`📁 [loadThemeLayout] 후보 경로:`, candidates);

            let loaded = false;
            for (const layoutPath of candidates) {
                try {
                    const module = (await themeLayouts[layoutPath]()) as { default: Component };
                    ThemeLayout = module.default;
                    console.log(`✅ [Layout] 테마 레이아웃 로드: ${themeId} (${layoutPath})`);
                    loaded = true;
                    break;
                } catch {
                    console.log(`⚠️ [Layout] 경로 실패, 다음 시도: ${layoutPath}`);
                }
            }

            if (!loaded) {
                ThemeLayout = null;
                console.log(`ℹ️ [Layout] 테마 레이아웃 없음, 기본 레이아웃 사용: ${themeId}`);
            }
        } catch (error) {
            console.error(`❌ [Layout] 테마 레이아웃 로드 실패: ${themeId}`, error);
            ThemeLayout = null;
        }
    }

    // activeTheme 변경 시 자동으로 레이아웃, Hook, Component 로드
    $effect(() => {
        console.log('🔄 [$effect] activeTheme 변경 감지:', activeTheme);
        loadThemeLayout(activeTheme);

        // 테마 Hook 및 Component 로드
        if (activeTheme) {
            loadThemeHooks(activeTheme);
            loadThemeComponents(activeTheme);
        }
    });

    onMount(() => {
        console.log('🚀 [onMount] 컴포넌트 마운트됨');

        // SSR에서 테마를 못 받았으면 (CSR 모드) API에서 로드
        if (!themeStore.currentTheme.activeTheme) {
            console.log('🔄 [onMount] SSR 테마 없음, API에서 로드');
            themeStore.loadActiveTheme();
        }

        // 인증 상태 초기화
        authActions.initAuth();

        // postMessage 리스너 (Admin에서 테마 변경 시 리로드)
        function handleMessage(event: MessageEvent) {
            // 보안: localhost에서만 허용
            if (!event.origin.includes('localhost')) return;

            if (event.data?.type === 'reload-theme') {
                console.log('🔄 테마 리로드 요청 받음');
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
                        const [themeId, timestampStr] = value.split(':');
                        const timestamp = parseInt(timestampStr, 10);

                        // 마지막 확인 이후 변경된 경우에만 리로드
                        if (timestamp > lastThemeCheckTimestamp) {
                            console.log('🔄 테마 변경 감지 (탭 전환):', themeId, '리로드 중...');
                            themeStore.loadActiveTheme();
                            lastThemeCheckTimestamp = timestamp;
                        }
                    }
                } catch (e) {
                    console.warn('테마 변경 감지 실패:', e);
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
    <title>{data.siteTitle || '다모앙'}</title>
    {#if data.siteDescription}
        <meta name="description" content={data.siteDescription} />
        <meta property="og:title" content={data.siteTitle} />
        <meta property="og:description" content={data.siteDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="{data.siteUrl}{data.pathname}" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={data.siteTitle} />
        <meta name="twitter:description" content={data.siteDescription} />
        <link rel="canonical" href="{data.siteUrl}{data.pathname}" />
        {#if data.siteUrl === 'https://muzia.net'}
            <meta name="keywords" content="뮤지아, muzia, musia, abwldk, 악보사보, 음악 커뮤니티, 시벨리우스, 피날레, 도리코, 사보 프로그램, 악보 제작, 작곡, 편곡, MIDI, DAW" />
            <meta property="og:site_name" content="뮤지아(Muzia)" />
            <meta property="og:image" content="https://muzia.net/logo-muzia.png" />
            <meta property="og:locale" content="ko_KR" />
            {@html `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://muzia.net/#organization","name":"뮤지아","alternateName":["Muzia","musia","abwldk","뮤지아닷넷"],"url":"https://muzia.net","logo":{"@type":"ImageObject","url":"https://muzia.net/logo-muzia.png"},"foundingDate":"2002-03-15","description":"2002년 취미로 시작하여 24년간 운영해온 대한민국 대표 음악 커뮤니티. 시벨리우스, 피날레, 도리코 등 악보사보 프로그램 전문.","contactPoint":{"@type":"ContactPoint","email":"help@muzia.net","contactType":"customer service"}},{"@type":"WebSite","@id":"https://muzia.net/#website","name":"뮤지아(Muzia)","url":"https://muzia.net","publisher":{"@id":"https://muzia.net/#organization"},"potentialAction":{"@type":"SearchAction","target":"https://muzia.net/search?q={search_term_string}","query-input":"required name=search_term_string"}},{"@type":"SiteNavigationElement","name":["Q&A","포럼","음악","시벨리우스","도리코","바이올린","출석부"],"url":["https://muzia.net/qna","https://muzia.net/forum","https://muzia.net/music","https://muzia.net/sibelius","https://muzia.net/dorico","https://muzia.net/violin","https://muzia.net/attendance"]}]}</script>`}
        {/if}
    {/if}
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
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
    <ThemeLayout>
        {@render children()}
    </ThemeLayout>
{:else if activeTheme}
    <!-- 테마 로딩 중 (activeTheme은 있지만 ThemeLayout이 아직 로드 안됨) -->
    <!-- 빈 화면으로 깜빡임 방지 -->
    <div class="min-h-screen bg-white"></div>
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
