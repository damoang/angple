<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte';

    let searchQuery = $state('');
    let isMobileMenuOpen = $state(false);

    function handleSearch(e: Event) {
        e.preventDefault();
        if (searchQuery.trim()) {
            window.location.href = `/wiki/${encodeURIComponent(searchQuery.trim())}`;
        }
    }

    function toggleMobileMenu() {
        isMobileMenuOpen = !isMobileMenuOpen;
    }
</script>

<header class="sticky top-0 z-50 border-b border-gray-200 bg-white">
    <div class="mx-auto max-w-7xl px-4">
        <div class="flex h-14 items-center justify-between">
            <!-- Logo -->
            <a href="/" class="flex items-center gap-2">
                <span class="text-xl font-bold text-blue-600">위키앙</span>
            </a>

            <!-- Search (Desktop) -->
            <form onsubmit={handleSearch} class="hidden flex-1 max-w-md mx-8 md:block">
                <div class="relative">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="문서 검색..."
                        class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 pr-10 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                    >
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </button>
                </div>
            </form>

            <!-- Right Actions -->
            <div class="flex items-center gap-3">
                <!-- Mobile Menu Button -->
                <button
                    onclick={toggleMobileMenu}
                    class="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
                >
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {#if isMobileMenuOpen}
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        {:else}
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        {/if}
                    </svg>
                </button>

                <!-- Auth Actions (Desktop) -->
                <div class="hidden items-center gap-2 md:flex">
                    {#if authStore.user}
                        <span class="text-sm text-gray-600">{authStore.user.nickname || authStore.user.username}</span>
                        <a href="/logout" class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                            로그아웃
                        </a>
                    {:else}
                        <a href="/login" class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
                            로그인
                        </a>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Mobile Menu -->
        {#if isMobileMenuOpen}
            <div class="border-t border-gray-200 py-4 md:hidden">
                <!-- Mobile Search -->
                <form onsubmit={handleSearch} class="mb-4">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="문서 검색..."
                        class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                </form>

                <!-- Mobile Nav -->
                <nav class="space-y-2">
                    <a href="/" class="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">대문</a>
                    <a href="/wiki/Special:RecentChanges" class="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">최근 변경</a>
                    <a href="/wiki/Special:Random" class="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">임의 문서</a>
                </nav>

                <!-- Mobile Auth -->
                <div class="mt-4 border-t border-gray-200 pt-4">
                    {#if authStore.user}
                        <span class="block px-3 py-2 text-sm text-gray-600">{authStore.user.nickname || authStore.user.username}</span>
                        <a href="/logout" class="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">로그아웃</a>
                    {:else}
                        <a href="/login" class="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">로그인</a>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</header>
