<script lang="ts">
    import { onMount, untrack } from 'svelte';
    import { goto, afterNavigate } from '$app/navigation';
    import Search from '@lucide/svelte/icons/search';
    import User from '@lucide/svelte/icons/user';
    import Bell from '@lucide/svelte/icons/bell';
    import X from '@lucide/svelte/icons/x';
    import Home from '@lucide/svelte/icons/home';
    import Sun from '@lucide/svelte/icons/sun';
    import Moon from '@lucide/svelte/icons/moon';
    import Smartphone from '@lucide/svelte/icons/smartphone';
    import DefaultLogo from '$lib/assets/logo.svg';
    import AlignJustify from '@lucide/svelte/icons/align-justify';
    import MessageIcon from './message-icon.svelte';
    import Sidebar from './sidebar.svelte';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import {
        NotificationDropdown,
        LevelupCelebration,
        XpLevelupToast
    } from '$lib/components/features/notification/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import { getAvatarUrl } from '$lib/utils/member-icon';
    import { menuStore } from '$lib/stores/menu.svelte';
    import { getIcon } from '$lib/utils/icon-map';
    import { resolveActiveLogo, resolveBrowserLogoTimeZone } from '$lib/utils/logo-schedule';
    import { normalizeWebUrl } from '$lib/utils/url-normalizer';
    import { page } from '$app/stores';
    import { browser } from '$app/environment';

    function isAnimatedSVGLogo(src: string | null | undefined): boolean {
        if (!src) return false;
        return /^https?:\/\//i.test(src) && /\.svg(?:$|\?)/i.test(src);
    }

    let logoNow = $state(new Date());
    const resolvedActiveLogo = $derived.by(() => {
        const logoData = $page.data.logoData;
        if (!logoData) return null;
        if (!browser) return logoData.active;

        return resolveActiveLogo(logoData.schedules || [], {
            now: logoNow,
            timeZone: resolveBrowserLogoTimeZone(logoData.requestLocale)
        });
    });
    const activeLogoSrc = $derived(resolvedActiveLogo?.logo_url || DefaultLogo);
    const activeLogoAlt = $derived(resolvedActiveLogo?.name || 'Logo');
    let headerLogoFailed = $state(false);
    let prefersReducedMotion = $state(false);

    $effect(() => {
        activeLogoSrc;
        untrack(() => {
            headerLogoFailed = false;
        });
    });

    const logoSrc = $derived.by(() => {
        if (headerLogoFailed) return DefaultLogo;
        if (prefersReducedMotion && isAnimatedSVGLogo(activeLogoSrc)) return DefaultLogo;

        return browser
            ? normalizeWebUrl(activeLogoSrc, { baseOrigin: window.location.origin })
            : normalizeWebUrl(activeLogoSrc);
    });
    const logoAlt = $derived(headerLogoFailed ? 'Logo' : activeLogoAlt);

    // 임시: 2026-06-03 제9회 전국동시지방선거 안내 배지 (KST 기준 6/3 00:00 ~ 6/4 00:00 자동 해제)
    const showElectionBadge = $derived.by(() => {
        const now = logoNow; // 이미 1초마다 갱신되는 reactive 시계
        const startUtc = new Date('2026-06-02T15:00:00Z'); // 6/3 00:00 KST
        const endUtc = new Date('2026-06-03T15:00:00Z'); // 6/4 00:00 KST
        return now >= startUtc && now < endUtc;
    });

    // SSR 안전한 인증 상태:
    // - 서버(SSR): $page.data.user 사용 (요청별 안전, 모듈 레벨 상태 오염 없음)
    // - 클라이언트(hydration 전): $page.data.user 사용 (authStore.isLoading = true)
    // - 클라이언트(onMount 후): authStore.user 사용 (syncAuth로 초기화됨)
    const ssrUser = $derived(
        $page.data.user
            ? {
                  mb_id: $page.data.user.id ?? '',
                  mb_name: $page.data.user.nickname ?? '',
                  mb_level: $page.data.user.level ?? 0,
                  mb_image: $page.data.user.mb_image,
                  mb_image_updated_at: $page.data.user.mb_image_updated_at
              }
            : null
    );
    const effectiveUser = $derived(browser && !authStore.isLoading ? authStore.user : ssrUser);
    const isEffectivelyLoggedIn = $derived(effectiveUser !== null && effectiveUser !== undefined);
    // #12642: SSR_STRIP_USER 환경에서 SSR user 가 없고 클라이언트 인증도 미해결인 동안.
    // SSR/hydration 양쪽에서 동일하게 스켈레톤을 렌더해 비로그인 UI 깜빡임을 막는다.
    const authResolving = $derived(authStore.isLoading && !ssrUser);

    let headerAvatarUrl = $derived(
        effectiveUser
            ? getAvatarUrl(effectiveUser.mb_image, effectiveUser.mb_image_updated_at) || null
            : null
    );
    let headerAvatarFailed = $state(false);

    // user 변경 시 실패 상태 리셋
    $effect(() => {
        if (effectiveUser) untrack(() => (headerAvatarFailed = false));
    });

    // 스크롤 상태 관리
    let isDrawerOpen = $state(false);
    let themeMode = $state<'system' | 'light' | 'dark' | 'amoled'>('light');
    let isScrolled = $state(false);

    // 스크롤 이벤트 핸들러
    let scrollRafPending = false;
    function handleScroll() {
        if (scrollRafPending) return;
        scrollRafPending = true;
        requestAnimationFrame(() => {
            isScrolled = window.scrollY > 0;
            scrollRafPending = false;
        });
    }

    // 드로워 메뉴 토글
    function toggleDrawer() {
        isDrawerOpen = !isDrawerOpen;
    }

    // body 스크롤 잠금 (드로워 열림 시)
    $effect(() => {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = isDrawerOpen ? 'hidden' : '';
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.body.style.overflow = '';
            }
        };
    });

    // 페이지 이동 시 드로워 자동 닫기
    afterNavigate(() => {
        untrack(() => {
            isDrawerOpen = false;
        });
    });

    // Escape 키로 드로워 닫기
    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && isDrawerOpen) {
            toggleDrawer();
        }
    }

    // 테마 모드 순환: light → dark → amoled → light
    function cycleThemeMode() {
        const el = document.documentElement;
        if (themeMode === 'light') {
            themeMode = 'dark';
            el.classList.add('dark');
            el.classList.remove('amoled');
        } else if (themeMode === 'dark') {
            themeMode = 'amoled';
            el.classList.remove('dark');
            el.classList.add('amoled');
        } else if (themeMode === 'amoled') {
            // 시스템 모드: OS 설정에 따름
            themeMode = 'system';
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            el.classList.toggle('dark', prefersDark);
            el.classList.remove('amoled');
        } else {
            themeMode = 'light';
            el.classList.remove('dark', 'amoled');
        }
        // localStorage + 쿠키 동시 기록 (SSR 동기화)
        try {
            if (themeMode === 'system') {
                localStorage.removeItem('themeMode');
            } else {
                localStorage.setItem('themeMode', themeMode);
            }
        } catch {}
        if (themeMode === 'light' || themeMode === 'system') {
            document.cookie = 'angple_theme_mode=;path=/;max-age=0;SameSite=Lax';
        } else {
            document.cookie =
                'angple_theme_mode=' + themeMode + ';path=/;max-age=31536000;SameSite=Lax';
        }
    }

    // 컴포넌트 마운트 시 스크롤 이벤트 등록 + 테마 복원
    onMount(() => {
        const logoTimer = window.setInterval(() => {
            logoNow = new Date();
        }, 60_000);
        const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
        prefersReducedMotion = reducedMotionMq.matches;

        // 테마 모드 복원: 쿠키 → localStorage → prefers-color-scheme
        let savedMode: string | null = null;
        const cookieMatch = document.cookie.match(/angple_theme_mode=(\w+)/);
        if (cookieMatch) {
            savedMode = cookieMatch[1];
        }
        if (!savedMode) {
            try {
                savedMode = localStorage.getItem('themeMode');
                const legacyDark = localStorage.getItem('darkMode');
                if (!savedMode && legacyDark === 'true') savedMode = 'dark';
            } catch {}
        }
        // 저장값(쿠키/localStorage)이 없으면 '시스템 모드'로 본다. prefers-color-scheme 로
        // savedMode 를 'dark' 로 덮어쓰면 시스템 사용자가 dark 로 오인되어 OS 변경 추종이
        // 끊긴다(#12886). 다크 OS 의 실제 dark 클래스는 app.html 인라인 스크립트가 이미 적용.
        if (savedMode === 'dark' || savedMode === 'amoled') {
            themeMode = savedMode;
        } else if (savedMode === 'light') {
            themeMode = 'light';
        } else {
            themeMode = 'system';
        }

        // cross-tab 테마 동기화 (다른 탭에서 테마 변경 시)
        function handleStorageChange(e: StorageEvent) {
            if (e.key === 'themeMode' && e.newValue) {
                const el = document.documentElement;
                el.classList.remove('dark', 'amoled');
                if (e.newValue === 'dark') el.classList.add('dark');
                else if (e.newValue === 'amoled') el.classList.add('amoled');
                themeMode = e.newValue as 'light' | 'dark' | 'amoled';
            }
        }

        // OS 다크모드 변경 감지 (사용자가 명시적 테마 설정 안 한 경우만)
        const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
        function handleSystemThemeChange(e: MediaQueryListEvent) {
            // 쿠키나 localStorage에 명시적 설정이 있으면 무시
            const hasCookie = /angple_theme_mode=\w+/.test(document.cookie);
            let hasLocal = false;
            try {
                hasLocal = !!localStorage.getItem('themeMode');
            } catch {}
            if (hasCookie || hasLocal) return;

            const el = document.documentElement;
            el.classList.remove('dark', 'amoled');
            if (e.matches) {
                el.classList.add('dark');
            }
            // 시스템 모드 유지 — OS 변경을 계속 추종하고 라벨도 '시스템'으로 일관.
            themeMode = 'system';
        }
        darkMq.addEventListener('change', handleSystemThemeChange);
        function handleReducedMotionChange(e: MediaQueryListEvent) {
            prefersReducedMotion = e.matches;
        }
        reducedMotionMq.addEventListener('change', handleReducedMotionChange);

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('keydown', handleKeydown);

        return () => {
            window.clearInterval(logoTimer);
            darkMq.removeEventListener('change', handleSystemThemeChange);
            reducedMotionMq.removeEventListener('change', handleReducedMotionChange);
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('keydown', handleKeydown);
        };
    });
</script>

<header
    class="bg-background border-border fixed left-0 right-0 top-0 z-50 will-change-[box-shadow,border-color] contain-paint"
    class:shadow-sm={isScrolled}
    class:border-b={isScrolled}
>
    <div
        class="container mx-auto flex h-12 items-center justify-between gap-2 !px-2.5 md:h-16 md:gap-3 md:!px-6"
    >
        <!-- 햄버거 메뉴 + 로고 -->
        <div class="flex min-w-0 flex-1 items-center pr-1.5 md:flex-none md:pr-2">
            <button
                onclick={toggleDrawer}
                class="hover:bg-accent relative rounded-lg p-2 transition-all duration-200 ease-out 2xl:hidden"
                aria-label="메뉴"
            >
                <span class="pointer-events-none absolute -inset-1"></span>
                <AlignJustify class="text-muted-foreground h-5 w-5" />
            </button>
            <a
                href="/"
                class="relative z-20 flex h-10 max-w-[clamp(88px,28vw,112px)] shrink-0 cursor-pointer items-center overflow-hidden rounded-md pe-1 ps-1 md:h-12 md:max-w-none md:pe-0 md:ps-0"
                aria-label="홈"
                onclick={(e: MouseEvent) => {
                    if (window.location.pathname === '/') {
                        e.preventDefault();
                        window.location.reload();
                    }
                }}
            >
                <img
                    src={logoSrc}
                    alt={logoAlt}
                    class="pointer-events-none block h-10 w-auto max-w-full select-none md:h-12"
                    width="98"
                    height="48"
                    decoding="async"
                    fetchpriority="high"
                    style="max-height:48px; contain:layout style paint;"
                    onerror={() => {
                        headerLogoFailed = true;
                    }}
                />
            </a>
            <!-- 임시: 2026-06-03 제9회 전국동시지방선거 안내 배지 (자동 해제, 외부 출처 = 선관위) -->
            {#if showElectionBadge}
                <a
                    href="https://info.nec.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="bg-primary/10 text-primary hover:bg-primary/15 ml-2 hidden items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors md:inline-flex"
                    title="제9회 전국동시지방선거 - 선관위 실시간 투표율 안내"
                    aria-label="제9회 전국동시지방선거 안내 (선관위)"
                >
                    🗳️ 6/3 지방선거
                </a>
            {/if}
            <!-- 플러그인 슬롯: 헤더 좌측 액션 (로고 옆) — Slot Catalog Sprint 2b -->
            <PluginSlot name="header-actions-left" />
        </div>

        <!-- 데스크톱 네비게이션 (show_in_header 메뉴 동적 렌더링) -->
        <!-- #12499: md(아이패드 세로) 구간에서 항목 폭 부족 시 한글 라벨이 글자 단위로
             세로 줄바꿈되던 문제 — 간격 축소(md) + 라벨 whitespace-nowrap 으로 해결 -->
        <nav class="hidden items-center space-x-4 md:flex lg:space-x-8">
            {#if menuStore.headerMenus.length > 0}
                {#each menuStore.headerMenus as headerMenu (headerMenu.id)}
                    {@const IconComp = getIcon(headerMenu.icon)}
                    {@const isExternal = headerMenu.url.startsWith('http')}
                    {@const isHome = headerMenu.url === '/'}
                    <a
                        href={headerMenu.url}
                        target={headerMenu.target === '_blank' ? '_blank' : undefined}
                        rel={headerMenu.target === '_blank' || isExternal ? 'noopener' : undefined}
                        class="text-foreground hover:text-primary flex items-center whitespace-nowrap transition-all duration-200 ease-out"
                        onclick={isHome
                            ? (e: MouseEvent) => {
                                  if (window.location.pathname === '/') {
                                      e.preventDefault();
                                      window.location.reload();
                                  }
                              }
                            : undefined}
                    >
                        <IconComp class="mr-2 h-5 w-5" />
                        {headerMenu.title}
                    </a>
                {/each}
            {:else}
                <!-- headerMenus가 비어있으면 홈 링크만 기본 표시 -->
                <a
                    href="/"
                    class="text-foreground hover:text-primary flex items-center whitespace-nowrap transition-all duration-200 ease-out"
                    onclick={(e: MouseEvent) => {
                        if (window.location.pathname === '/') {
                            e.preventDefault();
                            window.location.reload();
                        }
                    }}
                >
                    <Home class="mr-2 h-5 w-5" />
                    홈
                </a>
            {/if}
        </nav>

        <!-- 플러그인 슬롯: 헤더 중앙 액션 (nav 와 우측 아이콘 사이) — Slot Catalog Sprint 2b -->
        <PluginSlot name="header-actions-center" />

        <!-- 우측 아이콘 버튼들 -->
        <div class="flex shrink-0 items-center gap-1">
            <!-- 테마 모드 토글: light → dark → amoled -->
            <button
                onclick={cycleThemeMode}
                class="hover:bg-accent relative rounded-lg p-2 transition-all duration-200 ease-out"
                aria-label={themeMode === 'light'
                    ? '다크모드로 전환'
                    : themeMode === 'dark'
                      ? 'AMOLED 모드로 전환'
                      : '라이트모드로 전환'}
                title={themeMode === 'light'
                    ? '다크모드'
                    : themeMode === 'dark'
                      ? 'AMOLED'
                      : '라이트모드'}
            >
                <span class="pointer-events-none absolute -inset-1"></span>
                {#if themeMode === 'amoled'}
                    <Sun class="h-5 w-5 text-orange-400" />
                {:else if themeMode === 'dark'}
                    <Smartphone class="h-5 w-5 text-yellow-500" />
                {:else}
                    <Moon class="text-muted-foreground h-5 w-5" />
                {/if}
            </button>

            <!-- 검색 아이콘 — 전체 검색은 로그인 필수(/api/search 401)라 로그인 시에만 노출 (#12666) -->
            {#if isEffectivelyLoggedIn}
                <button
                    onclick={() => goto('/search')}
                    class="hover:bg-accent relative rounded-lg p-2 transition-all duration-200 ease-out"
                    aria-label="검색"
                >
                    <span class="pointer-events-none absolute inset-0 md:-inset-1"></span>
                    <Search class="text-muted-foreground h-5 w-5" />
                </button>
            {/if}

            <!-- 사용자 아이콘 (로그인/프로필) -->
            <!-- #12642: SSR_STRIP_USER 환경에서는 SSR 시점에 로그인 여부를 알 수 없어,
                 비로그인 UI 를 먼저 그리면 새로고침마다 "로그아웃됐다 로그인되는" 깜빡임으로
                 보인다. 인증이 확정될 때까지 중립 스켈레톤을 표시한다. -->
            {#if authResolving}
                <div class="flex items-center gap-1.5 px-2 py-1.5" aria-hidden="true">
                    <div class="bg-muted h-6 w-6 shrink-0 animate-pulse rounded-full"></div>
                </div>
                <div class="p-2" aria-hidden="true">
                    <div class="bg-muted h-5 w-5 animate-pulse rounded-full"></div>
                </div>
                <div class="p-2" aria-hidden="true">
                    <div class="bg-muted h-5 w-5 animate-pulse rounded-full"></div>
                </div>
            {:else if isEffectivelyLoggedIn && effectiveUser}
                <a
                    href="/my"
                    class="hover:bg-accent flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all duration-200 ease-out"
                >
                    {#if uiSettingsStore.hideMyProfile}
                        <div
                            class="bg-primary/10 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full"
                        >
                            <User class="text-primary h-3.5 w-3.5" />
                        </div>
                    {:else}
                        <div
                            class="h-6 w-6 shrink-0 overflow-hidden rounded-full {headerAvatarUrl &&
                            !headerAvatarFailed
                                ? ''
                                : 'bg-primary/10 flex items-center justify-center'}"
                        >
                            {#if headerAvatarUrl && !headerAvatarFailed}
                                <img
                                    src={headerAvatarUrl}
                                    alt={effectiveUser.mb_name}
                                    class="h-full w-full object-cover"
                                    onerror={() => {
                                        headerAvatarFailed = true;
                                    }}
                                />
                            {:else}
                                <span class="text-primary text-xs font-bold"
                                    >{effectiveUser.mb_name.charAt(0).toUpperCase()}</span
                                >
                            {/if}
                        </div>
                        {#if !uiSettingsStore.hideMyProfile}
                            <span class="text-foreground hidden text-sm font-medium md:inline">
                                {effectiveUser.mb_name}
                            </span>
                        {/if}
                    {/if}
                </a>
            {:else}
                <button
                    onclick={() => goto('/login')}
                    class="hover:bg-accent relative rounded-lg p-2 transition-all duration-200 ease-out"
                    aria-label="로그인"
                >
                    <span class="pointer-events-none absolute -inset-1"></span>
                    <User class="text-primary h-5 w-5" />
                </button>
            {/if}

            {#if !authResolving && isEffectivelyLoggedIn}
                <!-- 쪽지 아이콘 + 미읽음 배지 -->
                <MessageIcon />

                <!-- 알림 드롭다운 -->
                <NotificationDropdown />
                <LevelupCelebration />
                <XpLevelupToast />
            {:else if !authResolving}
                <!-- 알림 아이콘 (비로그인 시 단순 버튼) -->
                <button
                    class="hover:bg-accent relative rounded-lg p-2 transition-all duration-200 ease-out"
                    aria-label="알림"
                >
                    <span class="pointer-events-none absolute -inset-1"></span>
                    <Bell class="text-muted-foreground h-5 w-5" />
                </button>
            {/if}

            <!-- 햄버거 메뉴 (PC에서는 숨김) -->
            <!--
            <button
                onclick={toggleDrawer}
                class="hover:bg-accent hidden rounded-lg p-2 transition-all duration-200 ease-out md:inline-flex"
                aria-label="추가 메뉴"
            >
                <AlignJustify class="text-muted-foreground h-5 w-5" />
            </button>
            -->

            <!-- 플러그인 슬롯: 헤더 우측 아이콘 그룹 끝 (pwa-share 등) -->
            <PluginSlot name="header-actions-right" />
        </div>
    </div>
</header>

<!-- 드로워 메뉴 오버레이 -->
{#if isDrawerOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="bg-foreground/50 fixed inset-0 z-[60] transition-opacity duration-300 2xl:hidden"
        onclick={toggleDrawer}
        aria-hidden="true"
    ></div>
{/if}

<!-- 드로워 메뉴 (항상 DOM에 존재, 위치만 변경) -->
<div
    class="bg-background fixed bottom-0 left-0 top-0 z-[70] w-[85vw] max-w-80 transform shadow-lg transition-transform duration-300 ease-in-out"
    class:-translate-x-full={!isDrawerOpen}
    class:translate-x-0={isDrawerOpen}
>
    <div class="flex h-full min-w-0 flex-col px-3 py-2">
        <div class="mb-1 flex shrink-0 items-center justify-between">
            <h2 class="text-foreground text-base font-bold">추가 메뉴</h2>
            <button
                onclick={toggleDrawer}
                class="hover:bg-accent rounded-lg p-1 transition-all duration-200 ease-out"
                aria-label="메뉴 닫기"
            >
                <X class="text-muted-foreground h-5 w-5" />
            </button>
        </div>

        <!-- 사이드바 메뉴 -->
        <div class="min-h-0 flex-1 overflow-y-auto">
            <Sidebar compact />
        </div>
    </div>
</div>

<!-- 헤더 높이만큼 상단 패딩 추가 -->
<div class="h-12 sm:h-16"></div>
