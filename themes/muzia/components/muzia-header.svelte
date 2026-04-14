<script lang="ts">
    /**
     * Muzia Header — 인증 연동 + SEO 반영 + 테마 모드 토글
     */
    import { page } from '$app/stores';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { authStore, authActions } from '$lib/stores/auth.svelte';
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';

    let isMobileMenuOpen = $state(false);

    // 테마 모드
    const modes = ['light', 'dark', 'amoled', 'system'] as const;
    const modeIcons: Record<string, string> = { light: '☀️', dark: '🌙', amoled: '⚫', system: '💻' };
    const modeLabels: Record<string, string> = { light: '라이트', dark: '다크', amoled: 'AMOLED', system: '시스템' };
    let themeMode = $state<string>('system');

    function applyMode(m: string) {
        if (!browser) return;
        const html = document.documentElement;
        html.classList.remove('dark', 'amoled');
        if (m === 'dark') html.classList.add('dark');
        else if (m === 'amoled') { html.classList.add('dark'); html.classList.add('amoled'); }
        else if (m === 'system') {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) html.classList.add('dark');
        }
    }

    function cycleMode() {
        const idx = modes.indexOf(themeMode as any);
        themeMode = modes[(idx + 1) % modes.length];
        localStorage.setItem('muzia-theme-mode', themeMode);
        applyMode(themeMode);
    }

    onMount(() => {
        themeMode = localStorage.getItem('muzia-theme-mode') || 'system';
        applyMode(themeMode);
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (themeMode === 'system') applyMode('system');
        });
    });

    const tabs = [
        { id: 'feed', label: '피드', icon: '❤️', href: '/' },
        { id: 'qna', label: 'Q&A', icon: '💬', href: '/qna' },
        { id: 'forum', label: '포럼', icon: '📝', href: '/forum' },
        { id: 'music', label: '음악', icon: '🎵', href: '/music' },
        { id: 'dorico', label: '도리코', icon: '🎹', href: '/dorico' },
        { id: 'attendance', label: '출석', icon: '📅', href: '/attendance' },
        { id: 'notice', label: '공지', icon: '📢', href: '/notice' },
    ];

    function getActiveTab(pathname: string): string {
        if (pathname === '/') return 'feed';
        for (const tab of tabs) {
            if (tab.href !== '/' && pathname.startsWith(tab.href)) return tab.id;
        }
        return 'feed';
    }
</script>

<header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="container mx-auto flex h-16 items-center justify-between px-4">
        <!-- 로고 -->
        <div class="flex items-center gap-4">
            <button
                class="rounded-md p-2 hover:bg-accent md:hidden"
                onclick={() => isMobileMenuOpen = !isMobileMenuOpen}
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <a href="/" class="flex items-center gap-2">
                <img src="/logo-muzia.png" alt="Muzia" class="h-10" />
            </a>
        </div>

        <!-- 탭 네비게이션 -->
        <nav class="hidden items-center gap-1 md:flex">
            {#each tabs as tab}
                <Button
                    variant={getActiveTab($page.url.pathname) === tab.id ? 'default' : 'ghost'}
                    class="gap-1.5 text-base"
                    onclick={() => { window.location.href = tab.href; }}
                >
                    <span>{tab.icon}</span>
                    {tab.label}
                </Button>
            {/each}
        </nav>

        <!-- 검색 + 테마 토글 + 프로필/로그인 -->
        <div class="flex items-center gap-3">
            <div class="relative hidden sm:block">
                <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <Input placeholder="검색..." class="w-56 pl-10" />
            </div>

            <!-- 테마 모드 토글 -->
            <button
                class="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-accent"
                onclick={cycleMode}
                title="{modeLabels[themeMode]} 모드"
            >
                {modeIcons[themeMode]}
            </button>

            {#if authStore.isAuthenticated && authStore.user}
                <div class="flex items-center gap-2">
                    <span class="hidden text-sm font-medium sm:inline">{authStore.user.nickname || authStore.user.username}</span>
                    <Button variant="ghost" size="sm" onclick={() => authActions.logout()}>
                        로그아웃
                    </Button>
                </div>
            {:else}
                <a href="/login">
                    <Button variant="outline" size="sm" class="border-foreground/20 font-medium hover:bg-accent">
                        로그인
                    </Button>
                </a>
            {/if}
        </div>
    </div>

    <!-- 모바일 메뉴 -->
    {#if isMobileMenuOpen}
        <div class="border-t bg-background px-4 py-3 md:hidden">
            {#each tabs as item}
                <a
                    href={item.href}
                    class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-base text-foreground hover:bg-accent"
                    onclick={() => isMobileMenuOpen = false}
                >
                    <span>{item.icon}</span>
                    {item.label}
                </a>
            {/each}
        </div>
    {/if}
</header>
