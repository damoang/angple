<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte';

    let isSearchFocused = $state(false);
</script>

<header class="sticky top-0 z-50 border-b border-purple-100 bg-white/90 shadow-sm backdrop-blur-lg">
    <div class="container mx-auto px-4">
        <div class="flex h-16 items-center justify-between gap-6">
            <!-- Logo & Brand -->
            <div class="flex items-center gap-3">
                <button class="lg:hidden">
                    <span class="text-xl">☰</span>
                </button>
                <a href="/" class="flex items-center gap-2">
                    <div
                        class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg"
                    >
                        <span class="text-xl">🌈</span>
                    </div>
                    <div class="hidden sm:block">
                        <h1 class="text-xl font-bold text-gray-900">다모앙</h1>
                        <p class="text-xs text-gray-500">함께 모이는 즐거움</p>
                    </div>
                </a>
            </div>

            <!-- Search Bar -->
            <div class="hidden max-w-md flex-1 md:block">
                <div
                    class="relative transition-all duration-200"
                    class:ring-2={isSearchFocused}
                    class:ring-purple-300={isSearchFocused}
                    class:rounded-xl={isSearchFocused}
                >
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="게시글 검색..."
                        class="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm focus:border-transparent focus:bg-white focus:outline-none"
                        onfocus={() => (isSearchFocused = true)}
                        onblur={() => (isSearchFocused = false)}
                    />
                </div>
            </div>

            <!-- User Menu -->
            <div class="flex items-center gap-2">
                <!-- Search Icon (Mobile) -->
                <button class="rounded-lg p-2 hover:bg-gray-100 md:hidden">
                    <span class="text-xl">🔍</span>
                </button>

                <!-- Notifications -->
                <button class="relative rounded-lg p-2 hover:bg-gray-100">
                    <span class="text-xl">🔔</span>
                    <span
                        class="absolute right-1 top-1 h-2 w-2 rounded-full bg-pink-500 ring-2 ring-white"
                    ></span>
                </button>

                <!-- User Profile -->
                {#if authStore.isAuthenticated}
                    <div class="flex items-center gap-2">
                        <button
                            class="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100"
                        >
                            <div
                                class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-pink-400 text-white"
                            >
                                <span class="text-sm">👤</span>
                            </div>
                            <span class="hidden text-sm font-medium text-gray-900 lg:block"
                                >{authStore.user?.name}님</span
                            >
                        </button>
                    </div>
                {:else}
                    <button
                        class="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:scale-105 hover:shadow-lg"
                    >
                        로그인
                    </button>
                {/if}
            </div>
        </div>
    </div>
</header>
