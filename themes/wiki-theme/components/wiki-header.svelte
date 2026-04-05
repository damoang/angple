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

<header class="bg-background border-border sticky top-0 z-50 border-b">
    <div class="mx-auto max-w-7xl px-4">
        <div class="flex h-14 items-center justify-between">
            <!-- Logo -->
            <a href="/" class="flex items-center gap-2">
                <span class="text-primary text-xl font-bold">위키앙</span>
            </a>

            <!-- Search (Desktop) -->
            <form onsubmit={handleSearch} class="mx-8 hidden max-w-md flex-1 md:block">
                <div class="relative">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="문서 검색..."
                        class="border-border bg-muted focus:bg-background focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-1"
                    />
                    <button
                        type="submit"
                        class="text-muted-foreground hover:text-primary absolute right-2 top-1/2 -translate-y-1/2"
                    >
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </button>
                </div>
            </form>

            <!-- Right Actions -->
            <div class="flex items-center gap-3">
                <!-- Mobile Menu Button -->
                <button
                    onclick={toggleMobileMenu}
                    class="text-foreground hover:bg-muted rounded-lg p-2 md:hidden"
                >
                    <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {#if isMobileMenuOpen}
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        {:else}
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        {/if}
                    </svg>
                </button>

                <!-- Auth Actions (Desktop) -->
                <div class="hidden items-center gap-2 md:flex">
                    {#if authStore.user}
                        <span class="text-muted-foreground text-sm"
                            >{authStore.user.nickname || authStore.user.username}</span
                        >
                        <a
                            href="/logout"
                            class="text-foreground hover:bg-muted rounded-lg px-3 py-1.5 text-sm"
                        >
                            로그아웃
                        </a>
                    {:else}
                        <a
                            href="/login"
                            class="text-foreground hover:bg-muted rounded-lg px-3 py-1.5 text-sm"
                        >
                            로그인
                        </a>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Mobile Menu -->
        {#if isMobileMenuOpen}
            <div class="border-border border-t py-4 md:hidden">
                <!-- Mobile Search -->
                <form onsubmit={handleSearch} class="mb-4">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="문서 검색..."
                        class="border-border bg-muted focus:border-primary w-full rounded-lg border px-4 py-2 text-sm focus:outline-none"
                    />
                </form>

                <!-- Mobile Nav -->
                <nav class="space-y-2">
                    <a
                        href="/"
                        class="text-foreground hover:bg-muted block rounded-lg px-3 py-2 text-sm"
                        >대문</a
                    >
                    <a
                        href="/wiki/Special:RecentChanges"
                        class="text-foreground hover:bg-muted block rounded-lg px-3 py-2 text-sm"
                        >최근 변경</a
                    >
                    <a
                        href="/wiki/Special:Random"
                        class="text-foreground hover:bg-muted block rounded-lg px-3 py-2 text-sm"
                        >임의 문서</a
                    >
                </nav>

                <!-- Mobile Auth -->
                <div class="border-border mt-4 border-t pt-4">
                    {#if authStore.user}
                        <span class="text-muted-foreground block px-3 py-2 text-sm"
                            >{authStore.user.nickname || authStore.user.username}</span
                        >
                        <a
                            href="/logout"
                            class="text-foreground hover:bg-muted block rounded-lg px-3 py-2 text-sm"
                            >로그아웃</a
                        >
                    {:else}
                        <a
                            href="/login"
                            class="text-foreground hover:bg-muted block rounded-lg px-3 py-2 text-sm"
                            >로그인</a
                        >
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</header>
