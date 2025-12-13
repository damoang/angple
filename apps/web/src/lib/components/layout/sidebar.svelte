<script lang="ts">
    import {
        Accordion,
        AccordionItem,
        AccordionTrigger,
        AccordionContent
    } from '$lib/components/ui/accordion';
    import { Button } from '$lib/components/ui/button';
    import { cn } from '$lib/utils';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Users from '@lucide/svelte/icons/users';
    import CircleStar from '@lucide/svelte/icons/circle-star';
    import Circle from '@lucide/svelte/icons/circle';
    import UserWidget from './user-widget.svelte';

    let isCollapsed = $state(false);

    const communityLinks = [
        { href: '/free', label: '자유게시판', icon: CircleStar },
        { href: '/free', label: '자유게시판', icon: CircleStar },
        { href: '/free', label: '자유게시판', icon: CircleStar },
        { href: '/free', label: '자유게시판', icon: CircleStar }
    ];
    const gatheringLinks = [
        { href: '/gathering/1', label: '모임1', icon: Circle },
        { href: '/gathering/2', label: '모임2', icon: Circle },
        { href: '/gathering/3', label: '모임3', icon: Circle },
        { href: '/gathering/4', label: '모임4', icon: Circle },
        { href: '/gathering/5', label: '모임5', icon: Circle }
    ];
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
        <Accordion type="multiple" value={['item-1']} class="w-full">
            <!-- 커뮤니티 -->
            <AccordionItem value="item-1" class="border-none">
                <AccordionTrigger
                    class={cn(
                        'cursor-pointer',
                        'hover:no-underline',
                        isCollapsed &&
                            'flex justify-center [&[data-state=open]>div>svg.lucide-chevron-down]:hidden'
                    )}
                >
                    <div class=" flex items-center gap-2">
                        <MessageSquare class="text-dusty-400 size-5" />
                        <span class={cn('font-semibold', isCollapsed && 'hidden')}>커뮤니티</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent class="pb-1">
                    <div class="relative ms-2 overflow-hidden rounded-lg p-[1px]">
                        <div
                            class="from-border absolute inset-0 rounded-lg bg-gradient-to-r to-transparent to-[4%]"
                        ></div>
                        <div class="bg-background relative space-y-1 rounded-lg py-1 ps-1">
                            {#each communityLinks as link}
                                <Button
                                    variant="ghost"
                                    class="hover:bg-dusty-100 dark:hover:bg-dusty-800 w-full justify-start gap-2"
                                    href={link.href}
                                >
                                    {link.label}
                                    <!-- <svelte:component this={link.icon} class="size-4" /> -->
                                </Button>
                            {/each}
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>

            <!-- 모임 -->
            <AccordionItem value="item-2" class="border-none">
                <AccordionTrigger class="cursor-pointer hover:no-underline">
                    <div class=" flex items-center gap-2">
                        <Users class="text-dusty-400 size-5" />
                        <span class={cn('font-semibold', isCollapsed && 'hidden')}>모임</span>
                    </div>
                </AccordionTrigger>
                <AccordionContent class="space-y-1 pb-1">
                    <div class="relative ms-2 overflow-hidden rounded-lg p-[1px]">
                        <div
                            class="from-border absolute inset-0 rounded-lg bg-gradient-to-r to-transparent to-[4%]"
                        ></div>
                        <div class="bg-background relative space-y-1 rounded-lg py-1 ps-1">
                            {#each gatheringLinks as link}
                                <Button
                                    variant="ghost"
                                    class="hover:bg-dusty-100 dark:hover:bg-dusty-800 w-full justify-start gap-2"
                                    href={link.href}
                                >
                                    {link.label}
                                    <!-- <svelte:component this={link.icon} class="size-4" /> -->
                                </Button>
                            {/each}
                        </div>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </nav>
</div>
