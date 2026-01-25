<script lang="ts">
    import '../../app.css';
    import { page } from '$app/stores';
    import favicon from '$lib/assets/favicon.png';
    import AdminSidebar from '$lib/components/admin/layout/sidebar.svelte';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';

    let { children } = $props();

    // 로그인 페이지, /admin 메인에서는 사이드바 숨김
    const isLoginPage = $derived($page.url.pathname.includes('/admin/login'));
    const isAdminRoot = $derived($page.url.pathname === '/admin' || $page.url.pathname === '/admin/');
    const showSidebar = $derived(!isLoginPage && !isAdminRoot);

    onMount(() => {
        // 인증 상태 초기화
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>관리자 - 다모앙</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
    <!-- Wanted Sans Font -->
    <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/packages/wanted-sans/fonts/webfonts/static/split/WantedSans.min.css"
    />
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
    {#if showSidebar}
        <div class="flex h-screen overflow-hidden">
            <AdminSidebar />
            <main class="flex-1 overflow-y-auto p-6">
                {@render children?.()}
            </main>
        </div>
    {:else}
        <main class="min-h-screen">
            {@render children?.()}
        </main>
    {/if}
</div>
