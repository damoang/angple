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
        { key: 'home', text: '홈', url: '/', show: true },
        { key: 'explore', text: '톺아보기', url: '/explore', show: true },
        { key: 'recommended', text: '공감글', url: '/recommended/daily', show: true },
        { key: 'group', text: '소모임', url: '/groups', show: true },
        { key: 'feed', text: '피드', url: '/feed', show: true }
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
    <nav class="flex flex-wrap gap-1.5 {className}" aria-label="빠른 이동">
        {#each visibleMenus as menu (menu.key)}
            <a
                href={menu.url}
                class="rounded-lg px-3 py-1.5 text-sm transition-all duration-200 ease-out
                    {isActive(menu.url)
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
            >
                {menu.text}
            </a>
        {/each}
    </nav>
{/if}
