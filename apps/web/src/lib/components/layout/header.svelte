<script lang="ts">
    import { onMount } from 'svelte';
    import Zap from '@lucide/svelte/icons/zap';
    import Search from '@lucide/svelte/icons/search';
    import User from '@lucide/svelte/icons/user';
    import Bell from '@lucide/svelte/icons/bell';
    import Menu from '@lucide/svelte/icons/menu';
    import X from '@lucide/svelte/icons/x';
    import Sun from '@lucide/svelte/icons/sun';
    import Moon from '@lucide/svelte/icons/moon';

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
    class="bg-background border-dusty-300 fixed left-0 right-0 top-0 z-50 transition-transform duration-300 ease-in-out"
    class:translate-y-0={isHeaderVisible}
    class:-translate-y-full={!isHeaderVisible}
    class:shadow-sm={isScrolled}
    class:border-b={isScrolled}
>
    <div class="container mx-auto flex h-12 items-center justify-between md:h-16">
        <!-- 로고 -->
        <div class="flex items-center">
            <a href="/" class="flex items-center">
                <img src="https://dummy.net/assets/logo.png" alt="logo" class="h-12" />
            </a>
        </div>

        <!-- 데스크톱 네비게이션 -->
        <nav class="hidden items-center space-x-8 md:flex">
            <a
                href="/"
                class="text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300">홈</a
            >
            <a
                href="/community"
                class="text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300"
                >메뉴1</a
            >
            <a
                href="/marketplace"
                class="text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300"
                >메뉴2</a
            >
            <a
                href="/minipage"
                class="text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300"
                >메뉴3</a
            >
            <a
                href="/about"
                class="text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300"
                >메뉴4</a
            >
        </nav>

        <!-- 우측 아이콘 버튼들 -->
        <div class="flex items-center space-x-1">
            <!-- 다크모드 토글 -->
            <button
                onclick={toggleDarkMode}
                class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="다크모드 전환"
            >
                {#if isDarkMode}
                    <Sun class="h-5 w-5 text-yellow-500" />
                {:else}
                    <Moon class="h-5 w-5 text-gray-600 dark:text-gray-400" />
                {/if}
            </button>

            <!-- 번개 아이콘 (빠른 메뉴) -->
            <button
                class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="빠른 메뉴"
            >
                <Zap class="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>

            <!-- 검색 아이콘 -->
            <button
                class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="검색"
            >
                <Search class="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>

            <!-- 사용자 아이콘 (로그인/프로필) -->
            <button
                class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="사용자 메뉴"
            >
                <User class="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </button>

            <!-- 알림 아이콘 -->
            <button
                class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="알림"
            >
                <Bell class="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>

            <!-- 햄버거 메뉴 (추가 메뉴) -->
            <button
                onclick={toggleDrawer}
                class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="추가 메뉴"
            >
                <Menu class="h-5 w-5 text-gray-600 dark:text-gray-400" />
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
    class="fixed bottom-0 right-0 top-0 z-50 w-80 transform bg-white shadow-xl transition-transform duration-300 ease-in-out dark:bg-gray-900"
    class:translate-x-full={!isDrawerOpen}
    class:translate-x-0={isDrawerOpen}
>
    <div class="p-6">
        <div class="mb-8 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">추가 메뉴</h2>
            <button
                onclick={toggleDrawer}
                class="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="메뉴 닫기"
            >
                <X class="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </button>
        </div>

        <!-- 빈 메뉴 영역 -->
        <div class="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
            <p class="text-center">
                추가 메뉴<br />
                <span class="text-sm">곧 추가될 예정입니다.</span>
            </p>
        </div>
    </div>
</div>

<!-- 헤더 높이만큼 상단 패딩 추가 -->
<div class="sm:h-16 h-12"></div>
