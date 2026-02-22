<script lang="ts">
    import { page } from '$app/stores';
    import {
        Accordion,
        AccordionItem,
        AccordionTrigger,
        AccordionContent
    } from '$lib/components/ui/accordion';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import { menuStore } from '$lib/stores/menu.svelte';

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
    import { getComponentsForSlot } from '$lib/components/slot-manager';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';

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

    // 메뉴 데이터는 SSR에서 초기화된 스토어에서 가져옴
    const menuData = $derived(menuStore.menus);
    const loading = $derived(menuStore.loading);
    const error = $derived(menuStore.error);

    // Current path tracking for active menu highlighting
    const currentPath = $derived($page.url.pathname);

    function isActive(url: string): boolean {
        if (!url) return false;
        return currentPath === url || currentPath.startsWith(url + '/');
    }

    // Writable state for accordion — allows both auto-open and manual interaction
    let accordionValue = $state<string | undefined>(undefined);

    // Auto-open the accordion group containing the active menu when path or menu data changes
    $effect(() => {
        for (const menu of menuData) {
            if (menu.children?.some((child) => isActive(child.url))) {
                accordionValue = `item-${menu.id}`;
                return;
            }
        }
    });

    // Get icon component from icon name
    function getIcon(iconName?: string) {
        if (!iconName) return Circle;
        return iconMap[iconName] || Circle;
    }

    // 메뉴 필터링과 로딩은 menuStore에서 SSR로 처리됨
</script>

<div
    data-collapsed={isCollapsed}
    class="group flex flex-col gap-4 py-2 pe-3 data-[collapsed=true]:py-2"
>
    <!-- Slot: sidebar-left-top -->
    {#each getComponentsForSlot('sidebar-left-top') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}

    <div class="px-2">
        <UserWidget />
    </div>

    <nav
        class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
    >
        {#if loading}
            <div class="text-muted-foreground text-center text-sm">메뉴 로딩 중...</div>
        {:else if error}
            <div class="text-destructive text-center text-sm">{error}</div>
        {:else}
            <Accordion type="single" class="w-full" bind:value={accordionValue}>
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
                                    <IconComponent class="text-muted-foreground size-5" />
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
                                            {@const active = isActive(child.url)}
                                            <Button
                                                variant={active ? 'default' : 'ghost'}
                                                class={cn(
                                                    'w-full justify-start gap-2',
                                                    active
                                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                        : 'hover:bg-accent'
                                                )}
                                                href={child.url}
                                                rel="external"
                                            >
                                                <ChildIcon class="size-4" />
                                                {child.title}
                                                {#if child.shortcut}
                                                    <kbd
                                                        class="bg-muted text-muted-foreground ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[10px] font-medium"
                                                        >{child.shortcut}</kbd
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
                        {@const active = isActive(menu.url)}
                        <Button
                            variant={active ? 'default' : 'ghost'}
                            class={cn(
                                'w-full justify-start gap-2',
                                active
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                    : 'hover:bg-accent'
                            )}
                            href={menu.url}
                            rel="external"
                        >
                            <IconComponent class="size-5" />
                            <span class={cn(isCollapsed && 'hidden')}>{menu.title}</span>
                        </Button>
                    {/if}
                {/each}
            </Accordion>
        {/if}
    </nav>

    <!-- 사이드바 메뉴 아래 GAM 광고 -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="px-2">
            <AdSlot position="sidebar" height="250px" />
        </div>
    {/if}

    <!-- Slot: sidebar-left-bottom -->
    {#each getComponentsForSlot('sidebar-left-bottom') as slotComp (slotComp.id)}
        {@const Component = slotComp.component}
        <Component {...slotComp.props || {}} />
    {/each}
</div>
