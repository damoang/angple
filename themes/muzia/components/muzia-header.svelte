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

    // 알림
    let unreadCount = $state(0);
    let notifications = $state<any[]>([]);
    let showNotiDropdown = $state(false);
    let notiLoading = $state(false);

    function authHeaders(): Record<string, string> {
        if (!browser) return {};
        try { const t = localStorage.getItem('access_token'); return t ? { 'Authorization': `Bearer ${t}` } : {}; }
        catch { return {}; }
    }

    async function loadUnreadCount() {
        if (!authStore.isAuthenticated) return;
        try {
            const r = await fetch('/api/muzia/notifications?action=unread-count', { headers: authHeaders() });
            const d = await r.json();
            if (d.total_unread !== undefined) unreadCount = d.total_unread;
        } catch {}
    }

    async function loadNotifications() {
        if (!authStore.isAuthenticated) return;
        notiLoading = true;
        try {
            const r = await fetch('/api/muzia/notifications?page=1&limit=10', { headers: authHeaders() });
            const d = await r.json();
            if (d.items) { notifications = d.items; unreadCount = d.unread_count || 0; }
        } catch {}
        finally { notiLoading = false; }
    }

    async function markRead(id: number) {
        try { await fetch(`/api/muzia/notifications?action=read&id=${id}`, { method: 'POST', headers: authHeaders() }); } catch {}
    }

    async function markAllRead() {
        try {
            await fetch('/api/muzia/notifications?action=read-all', { method: 'POST', headers: authHeaders() });
            notifications = notifications.map(n => ({ ...n, is_read: true }));
            unreadCount = 0;
        } catch {}
    }

    function toggleNoti() {
        showNotiDropdown = !showNotiDropdown;
        if (showNotiDropdown) loadNotifications();
    }

    function formatTime(ds: string): string {
        const diff = Date.now() - new Date(ds).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 1) return '방금';
        if (m < 60) return `${m}분 전`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}시간 전`;
        const dy = Math.floor(h / 24);
        return dy < 7 ? `${dy}일 전` : new Date(ds).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }

    // 30초마다 미읽은 수 갱신
    $effect(() => {
        if (!browser) return;
        loadUnreadCount();
        const iv = setInterval(loadUnreadCount, 30000);
        return () => clearInterval(iv);
    });
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
                <img src="/logo-muzia.png" alt="Muzia" class="h-12" />
            </a>
        </div>

        <!-- 탭 네비게이션 (SvelteKit 클라이언트 네비게이션) -->
        <nav class="hidden items-center gap-1 md:flex">
            {#each tabs as tab}
                <a
                    href={tab.href}
                    class="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-base font-medium transition-colors
                        {getActiveTab($page.url.pathname) === tab.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                >
                    <span>{tab.icon}</span>
                    {tab.label}
                </a>
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

            <!-- 알림 벨 (로그인 시만) -->
            {#if authStore.isAuthenticated}
                <div class="relative">
                    <button class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-accent" onclick={toggleNoti}>
                        <svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                        {#if unreadCount > 0}
                            <span class="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        {/if}
                    </button>
                    {#if showNotiDropdown}
                        <div class="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-lg border bg-background shadow-lg">
                            <div class="flex items-center justify-between border-b px-3 py-2">
                                <span class="font-semibold">알림</span>
                                {#if unreadCount > 0}
                                    <button class="text-xs text-muted-foreground hover:text-foreground" onclick={markAllRead}>모두 읽음</button>
                                {/if}
                            </div>
                            <div class="max-h-80 overflow-y-auto">
                                {#if notiLoading}
                                    <div class="py-8 text-center text-sm text-muted-foreground">로딩 중...</div>
                                {:else if notifications.length === 0}
                                    <div class="py-8 text-center text-sm text-muted-foreground">알림이 없습니다</div>
                                {:else}
                                    {#each notifications as n}
                                        <a href={n.url || '#'} class="flex items-start gap-3 border-b px-3 py-3 transition-colors hover:bg-accent {n.is_read ? 'opacity-60' : ''}"
                                            onclick={() => { markRead(n.id); showNotiDropdown = false; }}>
                                            <div class="min-w-0 flex-1">
                                                <p class="text-sm font-medium line-clamp-1">{n.title}</p>
                                                <p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">{n.content}</p>
                                                <p class="mt-1 text-xs text-muted-foreground">{formatTime(n.created_at)}</p>
                                            </div>
                                            {#if !n.is_read}<div class="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500"></div>{/if}
                                        </a>
                                    {/each}
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}

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
