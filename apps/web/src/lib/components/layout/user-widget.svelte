<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';
    import { Skeleton } from '$lib/components/ui/skeleton';
    import { Progress } from '$lib/components/ui/progress';
    import LogIn from '@lucide/svelte/icons/log-in';
    import LogOut from '@lucide/svelte/icons/log-out';
    import User from '@lucide/svelte/icons/user';
    import Coins from '@lucide/svelte/icons/coins';
    import Star from '@lucide/svelte/icons/star';
    import { getUser, getIsLoggedIn, getIsLoading } from '$lib/stores/auth.svelte';
    import { getMemberIconUrl } from '$lib/utils/member-icon';

    // Reactive getters
    let user = $derived(getUser());
    let isLoggedIn = $derived(getIsLoggedIn());
    let isLoading = $derived(getIsLoading());

    // 등급명 (mb_level 기반)
    const GRADE_NAMES: Record<number, string> = {
        1: '앙님💔',
        2: '앙님❤️',
        3: '앙님💛',
        4: '앙님💙',
        5: '광고앙💚',
        6: '운영자',
        7: '운영자',
        8: '관리자',
        9: '관리자',
        10: '최고관리자'
    };
    let gradeName = $derived(GRADE_NAMES[user?.mb_level ?? 1] ?? '');

    // 레벨 게이지 (user 데이터에서 직접 계산)
    let levelProgress = $derived(
        user?.as_max && user.as_max > 0 && user.mb_exp !== undefined
            ? Math.round((user.mb_exp / user.as_max) * 100)
            : 0
    );
    let nextLevelExp = $derived(
        user?.as_max !== undefined && user.mb_exp !== undefined ? user.as_max - user.mb_exp : 0
    );

    // 아바타 URL (mb_image 우선, 없으면 member_image 경로로 생성)
    let avatarUrl = $derived(user?.mb_image || getMemberIconUrl(user?.mb_id) || null);
    let avatarFailed = $state(false);

    // user 변경 시 실패 상태 리셋
    $effect(() => {
        if (user) avatarFailed = false;
    });

    // 로그인/로그아웃 URL 생성 (PHP 레거시 로그인으로 리다이렉트)
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
            <!-- 프로필 아바타 -->
            <a
                href="/my"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors {avatarUrl &&
                !avatarFailed
                    ? 'overflow-hidden'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'}"
            >
                {#if avatarUrl && !avatarFailed}
                    <img
                        src={avatarUrl}
                        alt={user.mb_name}
                        class="h-full w-full object-cover"
                        onerror={() => {
                            avatarFailed = true;
                        }}
                    />
                {:else}
                    <User class="h-4 w-4" />
                {/if}
            </a>

            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                    <a href="/my" class="truncate text-sm font-medium hover:underline"
                        >{user.mb_name}</a
                    >
                    {#if gradeName}
                        <span class="shrink-0 text-[10px] leading-none">{gradeName}</span>
                    {/if}
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
        {#if user.as_level !== undefined}
            <a href="/my/exp" class="group mt-2 block">
                <div class="text-muted-foreground flex items-center justify-between text-[10px]">
                    <span>Lv.{user.as_level}</span>
                    {#if user.as_max && user.as_max > 0}
                        <span
                            >다음 레벨까지 <span class="text-foreground font-medium"
                                >{nextLevelExp.toLocaleString()}</span
                            ></span
                        >
                        <span>Lv.{user.as_level + 1}</span>
                    {/if}
                </div>
                {#if user.as_max && user.as_max > 0}
                    <Progress
                        value={levelProgress}
                        max={100}
                        class="mt-0.5 h-1.5 transition-all group-hover:h-2"
                    />
                {/if}
            </a>
        {/if}

        <!-- 내글 / 내댓글 / 전체 + 포인트 -->
        <div class="mt-2 space-y-1 text-xs">
            <div class="text-muted-foreground flex items-center justify-center gap-1.5">
                <a href="/my?tab=posts" class="hover:text-primary transition-colors">내글</a>
                <span class="text-border">·</span>
                <a href="/my?tab=comments" class="hover:text-primary transition-colors">내댓글</a>
                <span class="text-border">·</span>
                <a href="/my" class="hover:text-primary transition-colors">전체</a>
                <span class="text-border">·</span>
                <a
                    href="https://damoang.net/my"
                    rel="external"
                    target="_blank"
                    class="hover:text-primary transition-colors">분석</a
                >
            </div>
            {#if user.mb_point !== undefined || user.mb_exp !== undefined}
                <div class="grid grid-cols-2 gap-1">
                    {#if user.mb_point !== undefined}
                        <a
                            href="/my/points"
                            class="border-border hover:border-primary/30 hover:text-primary flex items-center justify-between rounded border px-2 py-1.5 transition-colors"
                        >
                            <Coins class="text-muted-foreground h-3 w-3" />
                            <span class="font-medium">{user.mb_point.toLocaleString()}</span>
                        </a>
                    {/if}
                    {#if user.mb_exp !== undefined}
                        <a
                            href="/my/exp"
                            class="border-border hover:border-primary/30 hover:text-primary flex items-center justify-between rounded border px-2 py-1.5 transition-colors"
                        >
                            <Star class="text-muted-foreground h-3 w-3" />
                            <span class="font-medium">{user.mb_exp.toLocaleString()}</span>
                        </a>
                    {/if}
                </div>
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
