<script lang="ts">
    import { page } from '$app/stores';
    import { invalidateAll } from '$app/navigation';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { DEFAULT_TAG_NAV_MENUS, type TagNavMenu } from './default-menus';

    interface Props {
        menus?: TagNavMenu[];
        class?: string;
    }

    let { menus: menusProp, class: className = '' }: Props = $props();

    // 우선순위: props > 위젯 레이아웃 스토어(DB) > 기본값
    const menus = $derived(menusProp ?? widgetLayoutStore.tagNavMenus ?? DEFAULT_TAG_NAV_MENUS);

    const visibleMenus = $derived(menus.filter((m) => m.show));
    const currentPath = $derived($page.url.pathname);

    function isActive(url: string): boolean {
        if (url === '/') return currentPath === '/';
        return currentPath === url || currentPath.startsWith(url + '/');
    }
</script>

{#if visibleMenus.length > 0}
    <nav class="tag-nav flex gap-1.5 overflow-x-auto {className}" aria-label="빠른 이동">
        {#each visibleMenus as menu (menu.key)}
            <a
                href={menu.url}
                onclick={(e) => {
                    // 현재 페이지와 동일한 메뉴 클릭 시 SvelteKit 이 navigation 을 생략해
                    // "클릭해도 아무 반응 없음" 처럼 보이는 문제(#12027) 방지.
                    // 좌측 카테고리 링크와 동일하게 invalidateAll() 로 새로고침.
                    if (isActive(menu.url)) {
                        e.preventDefault();
                        invalidateAll();
                        window.scrollTo(0, 0);
                    }
                }}
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

<style>
    /* #11769 메인 바로가기 가로 스크롤바 숨김 (스크롤 동작은 유지) */
    .tag-nav {
        scrollbar-width: none;
    }
    .tag-nav::-webkit-scrollbar {
        display: none;
    }
</style>
