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
                    // 정확히 같은 목록 페이지일 때만 navigation 을 생략하고 invalidateAll()
                    // 로 새로고침(#12027). 하위 경로(글 상세 /free/123 등)에서는 isActive 가
                    // true(탭 하이라이트용)여도 정상적으로 목록으로 이동해야 한다 — 안 그러면
                    // 글 상세에서 해당 탭 클릭 시 목록이 안 뜨고 무반응처럼 보임.
                    if (currentPath === menu.url) {
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
