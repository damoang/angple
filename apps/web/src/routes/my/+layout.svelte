<script lang="ts">
    import { page, navigating } from '$app/stores';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { Snippet } from 'svelte';
    import User from '@lucide/svelte/icons/user';
    import Coins from '@lucide/svelte/icons/coins';
    import Star from '@lucide/svelte/icons/star';
    import Ban from '@lucide/svelte/icons/ban';
    import Bookmark from '@lucide/svelte/icons/bookmark';
    import Settings from '@lucide/svelte/icons/settings';

    let { children }: { children: Snippet } = $props();

    const navItems = [
        { href: '/my', label: '마이페이지', icon: User, exact: true },
        { href: '/my/points', label: '포인트', icon: Coins, exact: false },
        { href: '/my/exp', label: '경험치', icon: Star, exact: false },
        { href: '/my/blocked', label: '차단 목록', icon: Ban, exact: false },
        { href: '/my/scraps', label: '스크랩', icon: Bookmark, exact: false },
        { href: '/member/settings', label: '설정', icon: Settings, exact: false }
    ];

    function isActive(href: string, exact: boolean, pathname: string): boolean {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    }
</script>

<div class="mx-auto max-w-4xl px-4 pt-4">
    <!-- 공통 네비게이션 -->
    <nav class="mb-6 overflow-x-auto">
        <div class="flex gap-1">
            {#each navItems as item (item.href)}
                {@const active = isActive(item.href, item.exact, $page.url.pathname)}
                <a href={item.href} class="shrink-0" data-sveltekit-preload-data="hover">
                    <Button variant={active ? 'default' : 'ghost'} size="sm">
                        <item.icon class="mr-1.5 h-4 w-4" />
                        {item.label}
                    </Button>
                </a>
            {/each}
        </div>
    </nav>
</div>

<!-- 각 페이지 콘텐츠 -->
{#if $navigating}
    <div class="mx-auto max-w-4xl px-4">
        <div class="flex justify-center py-12">
            <div
                class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
            ></div>
        </div>
    </div>
{:else}
    {@render children()}
{/if}
