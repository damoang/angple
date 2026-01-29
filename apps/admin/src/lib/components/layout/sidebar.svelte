<script lang="ts">
    import { page } from '$app/stores';
    import { cn } from '$lib/utils';
    import {
        LayoutDashboard,
        Palette,
        Settings,
        FileText,
        LayoutGrid,
        Menu
    } from '@lucide/svelte/icons';
    import { t } from '$lib/i18n';

    /**
     * Admin 앱 사이드바 네비게이션
     */

    const menuItems = [
        {
            titleKey: 'admin_dashboard_title',
            href: '/',
            icon: LayoutDashboard
        },
        {
            titleKey: 'admin_menus_title',
            href: '/menus',
            icon: Menu
        },
        {
            titleKey: 'admin_themes_title',
            href: '/themes',
            icon: Palette
        },
        {
            titleKey: 'admin_widgets_title',
            href: '/widgets',
            icon: LayoutGrid
        },
        {
            titleKey: 'admin_plugins_title',
            href: '/plugins',
            icon: FileText
        },
        {
            titleKey: 'admin_settings_title',
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
        <h1 class="text-xl font-bold">Angple Admin</h1>
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
                <span>{t(item.titleKey)}</span>
            </a>
        {/each}
    </nav>

    <!-- 하단 정보 -->
    <div class="border-border border-t p-4">
        <div class="text-muted-foreground text-xs">
            <p class="font-semibold">Angple Admin v0.1.0</p>
            <p class="mt-1">© 2026 SDK Co.</p>
        </div>
    </div>
</aside>
