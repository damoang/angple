<script lang="ts">
    import { page } from '$app/stores';
    import { cn } from '$lib/utils';
    import { LayoutDashboard, Palette, Settings, FileText, LayoutGrid, Menu } from '@lucide/svelte/icons';

    /**
     * Admin 앱 사이드바 네비게이션
     */

    const menuItems = [
        {
            title: '대시보드',
            href: '/',
            icon: LayoutDashboard
        },
        {
            title: '메뉴',
            href: '/menus',
            icon: Menu
        },
        {
            title: '테마',
            href: '/themes',
            icon: Palette
        },
        {
            title: '위젯',
            href: '/widgets',
            icon: LayoutGrid
        },
        {
            title: '플러그인',
            href: '/plugins',
            icon: FileText
        },
        {
            title: '설정',
            href: '/settings',
            icon: Settings
        }
    ];

    const currentPath = $derived($page.url.pathname);

    function isActive(href: string): boolean {
        if (href === '/') {
            return currentPath === '/';
        }
        return currentPath.startsWith(href);
    }
</script>

<aside class="bg-card border-border flex h-screen w-64 flex-col border-r">
    <!-- 로고 영역 -->
    <div class="border-border flex h-16 items-center border-b px-6">
        <h1 class="text-xl font-bold">다모앙 Admin</h1>
    </div>

    <!-- 메뉴 영역 -->
    <nav class="flex-1 space-y-1 p-4">
        {#each menuItems as item (item.href)}
            {@const Icon = item.icon}
            <a
                href={item.href}
                class={cn(
                    'hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                )}
            >
                <Icon class="h-5 w-5" />
                <span>{item.title}</span>
            </a>
        {/each}
    </nav>

    <!-- 하단 정보 -->
    <div class="border-border border-t p-4">
        <div class="text-muted-foreground text-xs">
            <p class="font-semibold">Angple Admin v0.1.0</p>
            <p class="mt-1">© 2025 SDK Co.</p>
        </div>
    </div>
</aside>
