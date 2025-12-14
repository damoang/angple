<script lang="ts">
    import { onMount } from 'svelte';
    import Search from '@lucide/svelte/icons/search';
    import User from '@lucide/svelte/icons/user';
    import Bell from '@lucide/svelte/icons/bell';
    import Menu from '@lucide/svelte/icons/menu';
    import X from '@lucide/svelte/icons/x';
    import Home from '@lucide/svelte/icons/home';
    import Rss from '@lucide/svelte/icons/rss';
    import Sun from '@lucide/svelte/icons/sun';
    import Moon from '@lucide/svelte/icons/moon';
    import Logo from '$lib/assets/logo.svg';
    import AlignJustify from '@lucide/svelte/icons/align-justify';
    import Sidebar from './sidebar.svelte';

    // 스크롤 상태 관리
    let isHeaderVisible = $state(true);
    let lastScrollY = $state(0);
    let isDrawerOpen = $state(false);
    let isDarkMode = $state(false);
    let isScrolled = $state(false);

    // 스크롤 이벤트 핸들러
    function handleScroll() {
        const currentScrollY = window.scrollY;

        // 스크롤 방향에 따라 헤더 표시/숨김 결정
        if (currentScrollY > lastScrollY && currentScrollY > 80) {
            // 아래로 스크롤 시 헤더 숨김
            isHeaderVisible = false;
        } else {
            // 위로 스크롤 시 헤더 표시
            isHeaderVisible = true;
        }

        // 스크롤 여부에 따라 isScrolled 상태 업데이트
        isScrolled = currentScrollY > 0;

        lastScrollY = currentScrollY;
    }

    // 드로워 메뉴 토글
    function toggleDrawer() {
        isDrawerOpen = !isDrawerOpen;
    }

    // 다크모드 토글
    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        document.documentElement.classList.toggle('dark');
    }

    // 컴포넌트 마운트 시 스크롤 이벤트 등록
    onMount(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    });
</script>

<header
    class="bg-background border-border fixed left-0 right-0 top-0 z-50 transition-transform duration-300 ease-in-out"
    class:translate-y-0={isHeaderVisible}
    class:-translate-y-full={!isHeaderVisible}
    class:shadow-sm={isScrolled}
    class:border-b={isScrolled}
>
    <div class="container mx-auto flex h-12 items-center justify-between md:h-16">
        <!-- 로고 -->
        <div class="flex items-center">
            <!-- 햄버거 메뉴 (추가 메뉴) - 2xl 미만에서 보임 -->
            <button
                onclick={toggleDrawer}
                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 mr-3 block rounded-lg pe-2 ps-4 transition-colors md:-ml-1 md:ps-0 2xl:hidden"
                aria-label="추가 메뉴"
            >
                <AlignJustify class="text-dusty-600 dark:text-dusty-400 h-6 w-6" />
            </button>
            <a href="/" class="flex items-center">
                <img src={Logo} alt="damoang" class="h-12" />
            </a>
        </div>

        <!-- 데스크톱 네비게이션 -->
        <nav class="hidden items-center space-x-8 md:flex">
            <a
                href="/"
                class="text-dusty-700 dark:text-dusty-300 flex items-center transition-colors hover:text-blue-600"
            >
                <Home class="mr-2 h-5 w-5" />
                홈
            </a>
            <a
                href="/free"
                class="text-dusty-700 dark:text-dusty-300 flex items-center transition-colors hover:text-blue-600"
            >
                <Rss class="mr-2 h-5 w-5" />
                피드
            </a>
        </nav>

        <!-- 우측 아이콘 버튼들 -->
        <div class="flex items-center space-x-1">
            <!-- 다크모드 토글 -->
            <button
                onclick={toggleDarkMode}
                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 rounded-lg p-2 transition-colors"
                aria-label="다크모드 전환"
            >
                {#if isDarkMode}
                    <Sun class="h-5 w-5 text-yellow-500" />
                {:else}
                    <Moon class="text-dusty-600 dark:text-dusty-400 h-5 w-5" />
                {/if}
            </button>

            <!-- 검색 아이콘 -->
            <button
                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 rounded-lg p-2 transition-colors"
                aria-label="검색"
            >
                <Search class="text-dusty-600 dark:text-dusty-400 h-5 w-5" />
            </button>

            <!-- 사용자 아이콘 (로그인/프로필) -->
            <button
                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 rounded-lg p-2 transition-colors"
                aria-label="사용자 메뉴"
            >
                <User class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </button>

            <!-- 알림 아이콘 -->
            <button
                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 rounded-lg p-2 transition-colors"
                aria-label="알림"
            >
                <Bell class="text-dusty-600 dark:text-dusty-400 h-5 w-5" />
            </button>

            <!-- 햄버거 메뉴 (추가 메뉴) -->
            <button
                onclick={toggleDrawer}
                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 hidden rounded-lg p-2 transition-colors 2xl:block"
                aria-label="추가 메뉴"
            >
                <Menu class="text-dusty-600 dark:text-dusty-400 h-5 w-5" />
            </button>
        </div>
    </div>
</header>

<!-- 드로워 메뉴 오버레이 -->
{#if isDrawerOpen}
    <div
        class="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
        onclick={toggleDrawer}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Escape' && toggleDrawer()}
    ></div>
{/if}

<!-- 드로워 메뉴 (항상 DOM에 존재, 위치만 변경) -->
<div
    class="dark:bg-dusty-900 fixed bottom-0 right-0 top-0 z-50 w-80 transform bg-white shadow-xl transition-transform duration-300 ease-in-out"
    class:translate-x-full={!isDrawerOpen}
    class:translate-x-0={isDrawerOpen}
>
    <div class="p-6">
        <div class="mb-8 flex items-center justify-between">
            <h2 class="text-dusty-900 text-xl font-bold dark:text-white">추가 메뉴</h2>
            <button
                onclick={toggleDrawer}
                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 rounded-lg p-2 transition-colors"
                aria-label="메뉴 닫기"
            >
                <X class="text-dusty-600 dark:text-dusty-400 h-6 w-6" />
            </button>
        </div>

        <!-- 사이드바 메뉴 -->
        <div class="overflow-y-auto">
            <Sidebar />
        </div>
    </div>
</div>

<!-- 헤더 높이만큼 상단 패딩 추가 -->
<div class="h-12 sm:h-16"></div>
