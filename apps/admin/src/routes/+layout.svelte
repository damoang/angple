<script lang="ts">
    import '../app.css';
    import favicon from '$lib/assets/favicon.png';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import Sidebar from '$lib/components/layout/sidebar.svelte';
    import { setupI18n } from '$lib/i18n';

    let { children } = $props();

    // i18n 초기화
    onMount(() => {
        setupI18n();
    });

    // 로그인 페이지에서는 사이드바 숨김
    const showSidebar = $derived($page.url.pathname !== '/');
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

{#if showSidebar}
    <div class="flex h-screen overflow-hidden">
        <Sidebar />
        <main class="flex-1 overflow-y-auto">
            {@render children?.()}
        </main>
    </div>
{:else}
    {@render children?.()}
{/if}
