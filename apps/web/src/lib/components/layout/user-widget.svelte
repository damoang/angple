<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import LogIn from '@lucide/svelte/icons/log-in';
    import LogOut from '@lucide/svelte/icons/log-out';
    import User from '@lucide/svelte/icons/user';
    import Coins from '@lucide/svelte/icons/coins';
    import Star from '@lucide/svelte/icons/star';
    import { getUser, getIsLoggedIn, getIsLoading } from '$lib/stores/auth.svelte';

    // Reactive getters
    let user = $derived(getUser());
    let isLoggedIn = $derived(getIsLoggedIn());
    let isLoading = $derived(getIsLoading());

    // 로그인/로그아웃 URL 생성
    let loginUrl = $derived(
        browser ? `/login?redirect=${encodeURIComponent(window.location.pathname)}` : '/login'
    );

    let logoutUrl = $derived(
        browser
            ? `https://damoang.net/bbs/logout.php?url=${encodeURIComponent(window.location.origin)}`
            : 'https://damoang.net/bbs/logout.php?url=https://web.damoang.net'
    );
</script>

<div class="bg-card mb-3 rounded-lg border p-3">
    {#if isLoading}
        <!-- 로딩 상태 -->
        <div class="flex items-center gap-2">
            <Skeleton class="h-8 w-8 rounded-full" />
            <div class="flex-1 space-y-1">
                <Skeleton class="h-3 w-20" />
                <Skeleton class="h-2 w-14" />
            </div>
        </div>
    {:else if isLoggedIn && user}
        <!-- 로그인 상태 (컴팩트) -->
        <div class="flex items-center gap-2">
            <!-- 프로필 아이콘 -->
            <div
                class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            >
                <User class="h-4 w-4" />
            </div>

            <!-- 사용자 정보 -->
            <div class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{user.mb_name}</span>
                <p class="text-muted-foreground truncate text-xs">{user.mb_id}</p>
            </div>

            <!-- 로그아웃 버튼 -->
            <a
                href={logoutUrl}
                class="text-muted-foreground hover:text-foreground shrink-0 p-1 transition-colors"
                aria-label="로그아웃"
            >
                <LogOut class="h-4 w-4" />
            </a>
        </div>

        <!-- 포인트 & 경험치 (인라인) -->
        <div class="mt-2 flex gap-2 text-xs">
            {#if user.mb_point !== undefined}
                <a
                    href="/my/points"
                    class="bg-muted/50 hover:bg-muted flex flex-1 items-center justify-between rounded px-2 py-1.5 transition-colors"
                >
                    <span class="text-muted-foreground flex items-center gap-1">
                        <Coins class="h-3 w-3" />
                        P
                    </span>
                    <span class="font-medium">{user.mb_point.toLocaleString()}</span>
                </a>
            {/if}
            {#if user.mb_exp !== undefined}
                <a
                    href="/my/exp"
                    class="bg-muted/50 hover:bg-muted flex flex-1 items-center justify-between rounded px-2 py-1.5 transition-colors"
                >
                    <span class="text-muted-foreground flex items-center gap-1">
                        <Star class="h-3 w-3 text-yellow-500" />
                        E
                    </span>
                    <span class="font-medium">{user.mb_exp.toLocaleString()}</span>
                </a>
            {/if}
        </div>
    {:else}
        <!-- 비로그인 상태 (컴팩트) -->
        <div class="flex items-center gap-2">
            <div class="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <User class="text-muted-foreground h-4 w-4" />
            </div>
            <Button size="sm" class="h-8 flex-1" href={loginUrl}>
                <LogIn class="mr-1.5 h-3.5 w-3.5" />
                로그인
            </Button>
        </div>
    {/if}
</div>
