<script lang="ts">
    import '../../app.css';
    import { page } from '$app/stores';
    import favicon from '$lib/assets/favicon.png';
    import AdminSidebar from '$lib/components/admin/layout/sidebar.svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import ShieldX from '@lucide/svelte/icons/shield-x';

    let { data, children } = $props();

    // 로그인 페이지, /admin 메인에서는 사이드바 숨김
    const isLoginPage = $derived($page.url.pathname.includes('/admin/login'));
    const isAdminRoot = $derived(
        $page.url.pathname === '/admin' || $page.url.pathname === '/admin/'
    );
    const showSidebar = $derived(!isLoginPage && !isAdminRoot && !data.accessDenied);

    onMount(() => {
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
    {#if data.accessDenied}
        <!-- 로그인은 됐지만 관리자 권한 없음 -->
        <div class="flex min-h-screen items-center justify-center p-4">
            <div class="text-center">
                <ShieldX class="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                <h1 class="mb-2 text-2xl font-bold">접근 권한이 없습니다</h1>
                <p class="text-muted-foreground mb-6">
                    {data.nickname ? `${data.nickname}님은` : '현재 계정은'} 관리자 권한이 없습니다.<br
                    />
                    관리자 계정으로 로그인해 주세요.
                </p>
                <div class="flex justify-center gap-3">
                    <Button variant="outline" href="/">홈으로 돌아가기</Button>
                    <Button href="/admin/login">다른 계정으로 로그인</Button>
                </div>
            </div>
        </div>
    {:else if showSidebar}
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
