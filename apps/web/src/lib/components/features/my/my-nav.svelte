<script lang="ts">
    import { page } from '$app/stores';
    import { Button } from '$lib/components/ui/button/index.js';
    import User from '@lucide/svelte/icons/user';
    import Coins from '@lucide/svelte/icons/coins';
    import Star from '@lucide/svelte/icons/star';
    import Ban from '@lucide/svelte/icons/ban';
    import Bookmark from '@lucide/svelte/icons/bookmark';
    import NotepadText from '@lucide/svelte/icons/notepad-text';
    import Palette from '@lucide/svelte/icons/palette';
    import Settings from '@lucide/svelte/icons/settings';
    import type { Component } from 'svelte';

    type NavItem = {
        href: string;
        label: string;
        icon: Component;
        exact: boolean;
    };

    type NavSection = {
        id: 'profile' | 'activity' | 'settings';
        href: string;
        label: string;
        icon: Component;
        match: (pathname: string) => boolean;
        children: NavItem[];
    };

    const sections: NavSection[] = [
        {
            id: 'profile',
            href: '/my',
            label: '프로필',
            icon: User,
            match: (pathname) => pathname === '/my',
            children: [{ href: '/my', label: '마이페이지', icon: User, exact: true }]
        },
        {
            id: 'activity',
            href: '/my/points',
            label: '활동내역',
            icon: Bookmark,
            match: (pathname) =>
                ['/my/points', '/my/exp', '/my/blocked', '/my/scraps', '/my/memos'].some((href) =>
                    pathname.startsWith(href)
                ),
            children: [
                { href: '/my/points', label: '포인트', icon: Coins, exact: false },
                { href: '/my/exp', label: '경험치', icon: Star, exact: false },
                { href: '/my/scraps', label: '스크랩', icon: Bookmark, exact: false },
                { href: '/my/blocked', label: '차단목록', icon: Ban, exact: false },
                { href: '/my/memos', label: '회원메모', icon: NotepadText, exact: false }
            ]
        },
        {
            id: 'settings',
            href: '/member/settings',
            label: '설정',
            icon: Settings,
            match: (pathname) =>
                pathname.startsWith('/member/settings') || pathname === '/my/settings',
            children: [
                { href: '/member/settings', label: '계정설정', icon: Settings, exact: true },
                { href: '/member/settings/ui', label: 'UI 설정', icon: Palette, exact: false }
            ]
        }
    ];

    function isActive(href: string, exact: boolean, pathname: string): boolean {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    }

    function getCurrentSection(pathname: string): NavSection {
        return sections.find((section) => section.match(pathname)) ?? sections[0];
    }

    const currentSection = $derived(getCurrentSection($page.url.pathname));
</script>

<div class="mx-auto max-w-4xl px-4 pt-4">
    <nav class="mb-6 space-y-3">
        <div class="grid grid-cols-3 gap-2">
            {#each sections as section (section.id)}
                {@const active = section.id === currentSection.id}
                <a href={section.href} class="min-w-0">
                    <Button variant={active ? 'default' : 'outline'} class="w-full justify-center">
                        <section.icon class="mr-1.5 h-4 w-4" />
                        {section.label}
                    </Button>
                </a>
            {/each}
        </div>

        <div class="flex flex-wrap gap-2">
            {#each currentSection.children as item (item.href)}
                {@const active = isActive(item.href, item.exact, $page.url.pathname)}
                <a href={item.href}>
                    <Button variant={active ? 'secondary' : 'ghost'} size="sm">
                        <item.icon class="mr-1.5 h-4 w-4" />
                        {item.label}
                    </Button>
                </a>
            {/each}
        </div>
    </nav>
</div>
