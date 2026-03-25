<script lang="ts">
    import { page } from '$app/stores';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';

    export interface TagNavMenu {
        key: string;
        text: string;
        url: string;
        show: boolean;
    }

    interface Props {
        menus?: TagNavMenu[];
        class?: string;
    }

    const DEFAULT_MENUS: TagNavMenu[] = [
        { key: 'explore', text: '모아보기', url: '/explore', show: true },
        { key: 'empathy', text: '공감글', url: '/empathy', show: true },
        { key: 'group', text: '소모임', url: '/groups', show: true },
        { key: 'free', text: '자유게시판', url: '/free', show: true },
        { key: 'qa', text: '질문답변', url: '/qa', show: true },
        { key: 'new', text: '새소식', url: '/new', show: true },
        { key: 'economy', text: '알뜰구매', url: '/economy', show: true },
        { key: 'promotion', text: '직접홍보', url: '/promotion', show: true },
        { key: 'lecture', text: '강좌팁', url: '/lecture', show: true },
        { key: 'tutorial', text: '사용기', url: '/tutorial', show: true },
        { key: 'message', text: '축하메시지', url: '/message', show: true }
    ];

    let { menus: menusProp, class: className = '' }: Props = $props();

    // 우선순위: props > 위젯 레이아웃 스토어(DB) > DEFAULT_MENUS
    const menus = $derived(menusProp ?? widgetLayoutStore.tagNavMenus ?? DEFAULT_MENUS);

    const visibleMenus = $derived(menus.filter((m) => m.show));
    const currentPath = $derived($page.url.pathname);

    function isActive(url: string): boolean {
        if (url === '/') return currentPath === '/';
        return currentPath === url || currentPath.startsWith(url + '/');
    }
</script>

{#if visibleMenus.length > 0}
    <nav class="flex gap-1.5 overflow-x-auto {className}" aria-label="빠른 이동">
        {#each visibleMenus as menu (menu.key)}
            <a
                href={menu.url}
                class="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ease-out
                    {isActive(menu.url)
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
            >
                {menu.text}
            </a>
        {/each}
    </nav>
{/if}
