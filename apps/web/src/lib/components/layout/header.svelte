<script lang="ts">
    import { onMount } from 'svelte';
    import { goto, afterNavigate } from '$app/navigation';
    import Search from '@lucide/svelte/icons/search';
    import User from '@lucide/svelte/icons/user';
    import Bell from '@lucide/svelte/icons/bell';
    import X from '@lucide/svelte/icons/x';
    import Home from '@lucide/svelte/icons/home';
    import Rss from '@lucide/svelte/icons/rss';
    import Sun from '@lucide/svelte/icons/sun';
    import Moon from '@lucide/svelte/icons/moon';
    import Smartphone from '@lucide/svelte/icons/smartphone';
    import Logo from '$lib/assets/logo.svg';
    import AlignJustify from '@lucide/svelte/icons/align-justify';
    import Shield from '@lucide/svelte/icons/shield';
    import Mail from '@lucide/svelte/icons/mail';
    import Sidebar from './sidebar.svelte';
    import { NotificationDropdown } from '$lib/components/features/notification/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { getAvatarUrl, getMemberIconUrl } from '$lib/utils/member-icon';

    let headerAvatarUrl = $derived(
        authStore.user
            ? getAvatarUrl(authStore.user.mb_image) ||
                  getMemberIconUrl(authStore.user.mb_id) ||
                  null
            : null
    );
    let headerAvatarFailed = $state(false);

    // user 변경 시 실패 상태 리셋
    $effect(() => {
        if (authStore.user) headerAvatarFailed = false;
    });

    // 스크롤 상태 관리
    let isDrawerOpen = $state(false);
    let themeMode = $state<'light' | 'dark' | 'amoled'>('light');
    let isScrolled = $state(false);

    // 스크롤 이벤트 핸들러
    function handleScroll() {
        isScrolled = window.scrollY > 0;
    }

    // 드로워 메뉴 토글
    function toggleDrawer() {
        isDrawerOpen = !isDrawerOpen;
    }

    // 페이지 이동 시 드로워 자동 닫기
    afterNavigate(() => {
        isDrawerOpen = false;
    });

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
        } else {
            themeMode = 'light';
            el.classList.remove('dark', 'amoled');
        }
        // localStorage + 쿠키 동시 기록 (SSR 동기화)
        try {
            localStorage.setItem('themeMode', themeMode);
        } catch {}
        if (themeMode === 'light') {
            document.cookie = 'angple_theme_mode=;path=/;max-age=0;SameSite=Lax';
        } else {
            document.cookie =
                'angple_theme_mode=' + themeMode + ';path=/;max-age=31536000;SameSite=Lax';
        }
    }

    // 컴포넌트 마운트 시 스크롤 이벤트 등록 + 테마 복원
    onMount(() => {
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
        if (!savedMode && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            savedMode = 'dark';
        }
        if (savedMode === 'dark' || savedMode === 'amoled') {
            themeMode = savedMode;
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
        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('scroll', handleScroll);
        };
    });
</script>

<header
    class="bg-background border-border fixed left-0 right-0 top-0 z-50"
    class:shadow-sm={isScrolled}
    class:border-b={isScrolled}
>
    <div class="container mx-auto flex h-12 items-center justify-between md:h-16">
        <!-- 로고 -->
        <div class="flex items-center">
            <a
                href="/"
                data-sveltekit-reload
                class="flex items-center ps-4 md:ps-0"
                onclick={(e: MouseEvent) => {
                    if (window.location.pathname === '/') {
                        e.preventDefault();
                        window.location.reload();
                    }
                }}
            >
                <img src={Logo} alt="damoang" class="h-12" />
            </a>
        </div>

        <!-- 데스크톱 네비게이션 -->
        <nav class="hidden items-center space-x-8 md:flex">
            <a
                href="/"
                data-sveltekit-reload
                class="text-foreground hover:text-primary flex items-center transition-all duration-200 ease-out"
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
            <a
                href="/feed"
                class="text-foreground hover:text-primary flex items-center transition-all duration-200 ease-out"
            >
                <Rss class="mr-2 h-5 w-5" />
                피드
            </a>
            <a
                href="https://web.damoang.net"
                target="_blank"
                rel="noopener"
                class="text-foreground hover:text-primary flex items-center transition-all duration-200 ease-out"
            >
                <Shield class="mr-2 h-5 w-5" />
                대피소
            </a>
        </nav>

        <!-- 우측 아이콘 버튼들 -->
        <div class="flex items-center space-x-1">
            <!-- 테마 모드 토글: light → dark → amoled -->
            <button
                onclick={cycleThemeMode}
                class="hover:bg-accent rounded-lg p-2 transition-all duration-200 ease-out"
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
                {#if themeMode === 'amoled'}
                    <Sun class="h-5 w-5 text-orange-400" />
                {:else if themeMode === 'dark'}
                    <Smartphone class="h-5 w-5 text-yellow-500" />
                {:else}
                    <Moon class="text-muted-foreground h-5 w-5" />
                {/if}
            </button>

            <!-- 검색 아이콘 -->
            <button
                onclick={() => goto('/search')}
                class="hover:bg-accent rounded-lg p-2 transition-all duration-200 ease-out"
                aria-label="검색"
            >
                <Search class="text-muted-foreground h-5 w-5" />
            </button>

            <!-- 사용자 아이콘 (로그인/프로필) -->
            {#if authStore.isAuthenticated && authStore.user}
                <a
                    href="/my"
                    class="hover:bg-accent flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-all duration-200 ease-out"
                >
                    <div
                        class="h-6 w-6 shrink-0 overflow-hidden rounded-full {headerAvatarUrl &&
                        !headerAvatarFailed
                            ? ''
                            : 'bg-primary/10 flex items-center justify-center'}"
                    >
                        {#if headerAvatarUrl && !headerAvatarFailed}
                            <img
                                src={headerAvatarUrl}
                                alt={authStore.user.mb_name}
                                class="h-full w-full object-cover"
                                onerror={() => {
                                    headerAvatarFailed = true;
                                }}
                            />
                        {:else}
                            <span class="text-primary text-xs font-bold"
                                >{authStore.user.mb_name.charAt(0).toUpperCase()}</span
                            >
                        {/if}
                    </div>
                    <span class="text-foreground hidden text-sm font-medium md:inline">
                        {authStore.user.mb_name}
                    </span>
                </a>
            {:else}
                <button
                    onclick={() => goto('/login')}
                    class="hover:bg-accent rounded-lg p-2 transition-all duration-200 ease-out"
                    aria-label="로그인"
                >
                    <User class="text-primary h-5 w-5" />
                </button>
            {/if}

            {#if authStore.isAuthenticated}
                <!-- 쪽지 아이콘 -->
                <button
                    onclick={() => goto('/messages')}
                    class="hover:bg-accent rounded-lg p-2 transition-all duration-200 ease-out"
                    aria-label="쪽지"
                >
                    <Mail class="text-muted-foreground h-5 w-5" />
                </button>

                <!-- 알림 드롭다운 -->
                <NotificationDropdown />
            {:else}
                <!-- 알림 아이콘 (비로그인 시 단순 버튼) -->
                <button
                    class="hover:bg-accent rounded-lg p-2 transition-all duration-200 ease-out"
                    aria-label="알림"
                >
                    <Bell class="text-muted-foreground h-5 w-5" />
                </button>
            {/if}

            <!-- 햄버거 메뉴 (추가 메뉴) -->
            <button
                onclick={toggleDrawer}
                class="hover:bg-accent rounded-lg p-2 transition-all duration-200 ease-out"
                aria-label="추가 메뉴"
            >
                <AlignJustify class="text-muted-foreground h-5 w-5" />
            </button>
        </div>
    </div>
</header>

<!-- 드로워 메뉴 오버레이 -->
{#if isDrawerOpen}
    <div
        class="bg-foreground/50 fixed inset-0 z-40 transition-opacity duration-300"
        onclick={toggleDrawer}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Escape' && toggleDrawer()}
    ></div>
{/if}

<!-- 드로워 메뉴 (항상 DOM에 존재, 위치만 변경) -->
<div
    class="bg-background fixed bottom-0 right-0 top-0 z-50 w-[85vw] max-w-80 transform shadow-lg transition-transform duration-300 ease-in-out"
    class:translate-x-full={!isDrawerOpen}
    class:translate-x-0={isDrawerOpen}
>
    <div class="flex h-full flex-col p-6">
        <div class="mb-8 flex shrink-0 items-center justify-between">
            <h2 class="text-foreground text-xl font-bold">추가 메뉴</h2>
            <button
                onclick={toggleDrawer}
                class="hover:bg-accent rounded-lg p-2 transition-all duration-200 ease-out"
                aria-label="메뉴 닫기"
            >
                <X class="text-muted-foreground h-6 w-6" />
            </button>
        </div>

        <!-- 사이드바 메뉴 -->
        <div class="min-h-0 flex-1 overflow-y-auto">
            <Sidebar />
        </div>
    </div>
</div>

<!-- 헤더 높이만큼 상단 패딩 추가 -->
<div class="h-12 sm:h-16"></div>
