<script lang="ts">
    import { onMount } from 'svelte';
    import {
        Accordion,
        AccordionItem,
        AccordionTrigger,
        AccordionContent
    } from '$lib/components/ui/accordion';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import { apiClient } from '$lib/api';
    import type { MenuItem } from '$lib/api/types.js';

    // Import all needed Lucide icons
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Users from '@lucide/svelte/icons/users';
    import CircleStar from '@lucide/svelte/icons/circle-star';
    import CircleHelp from '@lucide/svelte/icons/circle-help';
    import Images from '@lucide/svelte/icons/images';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import PenTool from '@lucide/svelte/icons/pen-tool';
    import Lightbulb from '@lucide/svelte/icons/lightbulb';
    import FolderOpen from '@lucide/svelte/icons/folder-open';
    import Gift from '@lucide/svelte/icons/gift';
    import MapPin from '@lucide/svelte/icons/map-pin';
    import Star from '@lucide/svelte/icons/star';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import Sparkles from '@lucide/svelte/icons/sparkles';
    import Coffee from '@lucide/svelte/icons/coffee';
    import UserCheck from '@lucide/svelte/icons/user-check';
    import Music from '@lucide/svelte/icons/music';
    import Info from '@lucide/svelte/icons/info';
    import HelpCircle from '@lucide/svelte/icons/help-circle';
    import BookText from '@lucide/svelte/icons/book-text';
    import Circle from '@lucide/svelte/icons/circle';
    import Cpu from '@lucide/svelte/icons/cpu';
    import Code from '@lucide/svelte/icons/code';
    import Gamepad2 from '@lucide/svelte/icons/gamepad-2';
    import BookOpen from '@lucide/svelte/icons/book-open';
    import Apple from '@lucide/svelte/icons/apple';

    import UserWidget from './user-widget.svelte';

    // Icon mapping object
    const iconMap: Record<string, typeof Circle> = {
        MessageSquare,
        Users,
        CircleStar,
        CircleHelp,
        Images,
        Newspaper,
        PenTool,
        Lightbulb,
        FolderOpen,
        Gift,
        MapPin,
        Star,
        TrendingUp,
        ShoppingCart,
        Megaphone,
        Sparkles,
        Coffee,
        UserCheck,
        Music,
        Info,
        HelpCircle,
        BookText,
        Circle,
        Cpu,
        Code,
        Gamepad2,
        BookOpen,
        Apple
    };

    let isCollapsed = $state(false);
    let menuData = $state<MenuItem[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // Get icon component from icon name
    function getIcon(iconName?: string) {
        if (!iconName) return Circle;
        return iconMap[iconName] || Circle;
    }

    onMount(async () => {
        try {
            menuData = await apiClient.getMenus();
            loading = false;
        } catch (err) {
            console.error('Failed to load menu data:', err);
            error = err instanceof Error ? err.message : '메뉴 로드 실패';
            loading = false;
        }
    });
</script>

<div
    data-collapsed={isCollapsed}
    class="group flex h-full flex-col gap-4 overflow-y-auto py-2 pe-3 data-[collapsed=true]:py-2"
>
    <!-- 로그인 위젯 -->
    <div class="px-2">
        <UserWidget />
    </div>

    <nav
        class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
    >
        {#if loading}
            <div class="text-muted-foreground text-center text-sm">메뉴 로딩 중...</div>
        {:else if error}
            <div class="text-center text-sm text-red-500">{error}</div>
        {:else}
            <Accordion type="single" class="w-full">
                {#each menuData as menu (menu.id)}
                    {@const IconComponent = getIcon(menu.icon)}
                    {#if menu.children && menu.children.length > 0}
                        <!-- 하위 메뉴가 있는 경우 -->
                        <AccordionItem value={`item-${menu.id}`} class="border-none">
                            <AccordionTrigger
                                class={cn(
                                    'cursor-pointer',
                                    'hover:no-underline',
                                    isCollapsed &&
                                        'flex justify-center [&[data-state=open]>div>svg.lucide-chevron-down]:hidden'
                                )}
                            >
                                <div class="flex items-center gap-2">
                                    <IconComponent class="text-dusty-400 size-5" />
                                    <span class={cn('font-semibold', isCollapsed && 'hidden')}
                                        >{menu.title}</span
                                    >
                                </div>
                            </AccordionTrigger>
                            <AccordionContent class="pb-1">
                                <div class="relative ms-2 overflow-hidden rounded-lg p-[1px]">
                                    <div
                                        class="from-border absolute inset-0 rounded-lg bg-gradient-to-r to-transparent to-[4%]"
                                    ></div>
                                    <div
                                        class="bg-background relative space-y-1 rounded-lg py-1 ps-1"
                                    >
                                        {#each menu.children as child (child.id)}
                                            {@const ChildIcon = getIcon(child.icon)}
                                            <Button
                                                variant="ghost"
                                                class="hover:bg-dusty-100 dark:hover:bg-dusty-800 w-full justify-start gap-2"
                                                href={child.url}
                                            >
                                                <ChildIcon class="size-4" />
                                                {child.title}
                                                {#if child.shortcut}
                                                    <span
                                                        class="text-muted-foreground ml-auto text-xs"
                                                        >{child.shortcut}</span
                                                    >
                                                {/if}
                                            </Button>
                                        {/each}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    {:else}
                        <!-- 하위 메뉴가 없는 단독 메뉴 -->
                        <Button
                            variant="ghost"
                            class="hover:bg-dusty-100 dark:hover:bg-dusty-800 w-full justify-start gap-2"
                            href={menu.url}
                        >
                            <IconComponent class="size-5" />
                            <span class={cn(isCollapsed && 'hidden')}>{menu.title}</span>
                        </Button>
                    {/if}
                {/each}
            </Accordion>
        {/if}
    </nav>
</div>
