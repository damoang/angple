<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import LogIn from '@lucide/svelte/icons/log-in';
    import LogOut from '@lucide/svelte/icons/log-out';
    import User from '@lucide/svelte/icons/user';
    import { getUser, getIsLoggedIn, getIsLoading } from '$lib/stores/auth.svelte';

    // Reactive getters
    let user = $derived(getUser());
    let isLoggedIn = $derived(getIsLoggedIn());
    let isLoading = $derived(getIsLoading());

    // 로그인/로그아웃 URL 생성
    let loginUrl = $derived(
        browser
            ? `https://damoang.net/bbs/login.php?url=${encodeURIComponent(window.location.href)}`
            : 'https://damoang.net/bbs/login.php?url=https://web.damoang.net'
    );

    let logoutUrl = $derived(
        browser
            ? `https://damoang.net/bbs/logout.php?url=${encodeURIComponent(window.location.origin)}`
            : 'https://damoang.net/bbs/logout.php?url=https://web.damoang.net'
    );
</script>

<div class="bg-card mb-4 rounded-lg border p-4">
    {#if isLoading}
        <!-- 로딩 상태 -->
        <div class="flex items-center gap-3">
            <Skeleton class="h-10 w-10 rounded-full" />
            <div class="flex-1 space-y-2">
                <Skeleton class="h-4 w-24" />
                <Skeleton class="h-3 w-16" />
            </div>
        </div>
    {:else if isLoggedIn && user}
        <!-- 로그인 상태 -->
        <div class="flex items-center gap-3">
            <!-- 프로필 아이콘 -->
            <div
                class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full"
            >
                <User class="h-5 w-5" />
            </div>

            <!-- 사용자 정보 -->
            <div class="flex-1 overflow-hidden">
                <span class="truncate font-medium">{user.mb_name}</span>
                <p class="text-muted-foreground truncate text-xs">{user.mb_id}</p>
            </div>
        </div>

        <!-- 로그아웃 버튼 -->
        <Button variant="outline" size="sm" class="mt-3 w-full" href={logoutUrl}>
            <LogOut class="mr-2 h-4 w-4" />
            로그아웃
        </Button>
    {:else}
        <!-- 비로그인 상태 -->
        <div class="text-center">
            <p class="text-muted-foreground mb-3 text-sm">로그인이 필요합니다</p>
            <Button class="w-full" href={loginUrl}>
                <LogIn class="mr-2 h-4 w-4" />
                로그인
            </Button>
        </div>
    {/if}
</div>
