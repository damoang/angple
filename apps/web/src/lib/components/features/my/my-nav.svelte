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

    const navItems = [
        { href: '/my', label: '마이페이지', icon: User, exact: true },
        { href: '/my/points', label: '포인트', icon: Coins, exact: false },
        { href: '/my/exp', label: '경험치', icon: Star, exact: false },
        { href: '/my/blocked', label: '차단 목록', icon: Ban, exact: false },
        { href: '/my/scraps', label: '스크랩', icon: Bookmark, exact: false },
        { href: '/my/memos', label: '회원 메모', icon: NotepadText, exact: false },
        { href: '/member/settings/ui', label: 'UI 설정', icon: Palette, exact: false },
        { href: '/member/settings', label: '설정', icon: Settings, exact: true }
    ];

    function isActive(href: string, exact: boolean, pathname: string): boolean {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    }
</script>

<div class="mx-auto max-w-4xl px-4 pt-4">
    <nav class="mb-6 overflow-x-auto">
        <div class="flex gap-1">
            {#each navItems as item (item.href)}
                {@const active = isActive(item.href, item.exact, $page.url.pathname)}
                <a href={item.href} class="shrink-0">
                    <Button variant={active ? 'default' : 'ghost'} size="sm">
                        <item.icon class="mr-1.5 h-4 w-4" />
                        {item.label}
                    </Button>
                </a>
            {/each}
        </div>
    </nav>
</div>
