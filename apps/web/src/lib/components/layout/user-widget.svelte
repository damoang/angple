<script lang="ts">
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import { Progress } from '$lib/components/ui/progress';
    import LogIn from '@lucide/svelte/icons/log-in';
    import LogOut from '@lucide/svelte/icons/log-out';
    import User from '@lucide/svelte/icons/user';
    import Coins from '@lucide/svelte/icons/coins';
    import { getUser, getIsLoggedIn, getIsLoading } from '$lib/stores/auth.svelte';
    import { apiClient } from '$lib/api';
    import type { ExpSummary } from '$lib/api/types';

    // Reactive getters
    let user = $derived(getUser());
    let isLoggedIn = $derived(getIsLoggedIn());
    let isLoading = $derived(getIsLoading());

    // 경험치 요약 (레벨 게이지용)
    let expSummary = $state<ExpSummary | null>(null);

    // 로그인/로그아웃 URL 생성
    let loginUrl = $derived(
        browser ? `/login?redirect=${encodeURIComponent(window.location.pathname)}` : '/login'
    );

    let logoutUrl = $derived(
        browser
            ? `https://damoang.net/bbs/logout.php?url=${encodeURIComponent(window.location.origin)}`
            : 'https://damoang.net/bbs/logout.php?url=https://web.damoang.net'
    );

    // 로그인 시 경험치 요약 로드
    $effect(() => {
        if (isLoggedIn && user) {
            apiClient.getExpSummary().then((data) => {
                expSummary = data;
            }).catch(() => {
                // 실패해도 위젯은 정상 표시
            });
        }
    });
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
        <!-- 프로필 헤더 -->
        <div class="flex items-center gap-2">
            <a
                href="/my"
                class="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-primary/20"
            >
                <User class="h-4 w-4" />
            </a>

            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                    <a href="/my" class="truncate text-sm font-medium hover:underline">{user.mb_name}</a>
                    <span class="bg-primary/10 text-primary shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold leading-none">
                        Lv.{user.mb_level}
                    </span>
                </div>
                <p class="text-muted-foreground truncate text-xs">{user.mb_id}</p>
            </div>

            <a
                href={logoutUrl}
                class="text-muted-foreground hover:text-foreground shrink-0 p-1 transition-colors"
                aria-label="로그아웃"
            >
                <LogOut class="h-4 w-4" />
            </a>
        </div>

        <!-- 레벨 게이지 -->
        {#if expSummary}
            <a href="/my/exp" class="group mt-2 block">
                <div class="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Lv.{expSummary.current_level}</span>
                    <span>Lv.{expSummary.current_level + 1}</span>
                </div>
                <Progress value={expSummary.level_progress} max={100} class="mt-0.5 h-1.5 group-hover:h-2 transition-all" />
                <p class="mt-0.5 text-center text-[10px] text-muted-foreground">
                    다음 레벨까지 <span class="font-medium text-foreground">{expSummary.next_level_exp.toLocaleString()}</span>
                </p>
            </a>
        {/if}

        <!-- 포인트 + 내글 / 내댓글 / 전체 -->
        <div class="mt-2 space-y-1 text-xs">
            {#if user.mb_point !== undefined}
                <a
                    href="/my/points"
                    class="bg-muted/50 hover:bg-muted flex items-center justify-between rounded px-2 py-1.5 transition-colors"
                >
                    <Coins class="h-3 w-3 text-muted-foreground" />
                    <span class="font-medium">{user.mb_point.toLocaleString()}</span>
                </a>
            {/if}
            <div class="grid grid-cols-3 gap-1">
                <a
                    href="/my?tab=posts"
                    class="bg-muted/50 hover:bg-muted flex items-center justify-center rounded px-2 py-1.5 text-muted-foreground transition-colors"
                >
                    내글
                </a>
                <a
                    href="/my?tab=comments"
                    class="bg-muted/50 hover:bg-muted flex items-center justify-center rounded px-2 py-1.5 text-muted-foreground transition-colors"
                >
                    내댓글
                </a>
                <a
                    href="/my"
                    class="bg-muted/50 hover:bg-muted flex items-center justify-center rounded px-2 py-1.5 text-muted-foreground transition-colors"
                >
                    전체
                </a>
            </div>
        </div>
    {:else}
        <!-- 비로그인 상태 (컴팩트) -->
        <div class="flex items-center gap-2">
            <div
                class="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            >
                <User class="text-muted-foreground h-4 w-4" />
            </div>
            <Button size="sm" class="h-8 flex-1" href={loginUrl}>
                <LogIn class="mr-1.5 h-3.5 w-3.5" />
                로그인
            </Button>
        </div>
    {/if}
</div>
