<script lang="ts">
    import { browser } from '$app/environment';
    import { Button } from '$lib/components/ui/button';
    import { Skeleton } from '$lib/components/ui/skeleton';

    import LogIn from '@lucide/svelte/icons/log-in';
    import LogOut from '@lucide/svelte/icons/log-out';
    import User from '@lucide/svelte/icons/user';
    import Coins from '@lucide/svelte/icons/coins';
    import Star from '@lucide/svelte/icons/star';
    import { getUser, getIsLoggedIn, getIsLoading, authActions } from '$lib/stores/auth.svelte';
    import { getAvatarUrl } from '$lib/utils/member-icon';
    import { getGradeName } from '$lib/utils/grade';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';

    interface Props {
        compact?: boolean;
    }

    let { compact = false }: Props = $props();

    let isLoggingOut = $state(false);

    async function handleLogout() {
        if (isLoggingOut) return;
        isLoggingOut = true;
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch {
            // 에러 무시
        }
        // 클라이언트에서도 모든 인증 쿠키 강제 삭제 (도메인 불일치 대비)
        const domains = ['', '.damoang.net', 'damoang.net', 'dev.damoang.net', 'web.damoang.net'];
        const names = ['damoang_jwt', 'refresh_token', 'access_token', 'angple_sid', 'angple_csrf'];
        for (const name of names) {
            for (const domain of domains) {
                const domainPart = domain ? `; domain=${domain}` : '';
                document.cookie = `${name}=; path=/; max-age=0${domainPart}`;
            }
        }
        authActions.resetAuth();
        window.location.href = '/';
    }

    // Reactive getters
    let user = $derived(getUser());
    let isLoggedIn = $derived(getIsLoggedIn());
    let isLoading = $derived(getIsLoading());

    let gradeName = $derived(user ? getGradeName(user.mb_level) : '');

    // 아바타 URL (mb_image 우선 → avatar_url → member_image 경로 폴백)
    let avatarUrl = $derived(getAvatarUrl(user?.mb_image, user?.mb_image_updated_at) || null);
    let avatarFailed = $state(false);

    // user 변경 시 실패 상태 리셋
    $effect(() => {
        if (user) avatarFailed = false;
    });

    // 로그인 URL (Angple 자체 로그인 페이지)
    let loginUrl = $derived(
        browser ? `/login?redirect=${encodeURIComponent(window.location.pathname)}` : '/login'
    );
</script>

<div class={compact ? 'bg-card mb-1 rounded-lg border p-2' : 'bg-card mb-3 rounded-lg border p-3'}>
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
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors {!uiSettingsStore.hideMyProfile &&
                avatarUrl &&
                !avatarFailed
                    ? 'overflow-hidden'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'}"
            >
                {#if uiSettingsStore.hideMyProfile}
                    <User class="h-4 w-4" />
                {:else if avatarUrl && !avatarFailed}
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
                    {#if uiSettingsStore.hideMyProfile}
                        <a
                            href="/my"
                            class="text-muted-foreground truncate text-sm font-medium hover:underline"
                            >회원</a
                        >
                    {:else}
                        <a href="/my" class="truncate text-sm font-medium hover:underline"
                            >{user.mb_name}</a
                        >
                    {/if}
                    {#if gradeName && !uiSettingsStore.hideMyProfile}
                        <span class="shrink-0 text-[10px] leading-none">{gradeName}</span>
                    {/if}
                </div>
                {#if !uiSettingsStore.hideMyProfile}
                    <p class="text-muted-foreground truncate text-xs">{user.mb_id}</p>
                {/if}
            </div>

            <button
                onclick={handleLogout}
                disabled={isLoggingOut}
                class="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer p-1 transition-colors disabled:opacity-50"
                aria-label="로그아웃"
            >
                <LogOut class="h-4 w-4" />
            </button>
        </div>

        <!-- 레벨 게이지 (as_level 제거됨) -->

        <!-- 내글 / 내댓글 / 전체 + 포인트 -->
        <div class={compact ? 'mt-1 space-y-0.5 text-xs' : 'mt-2 space-y-1 text-xs'}>
            <div class="text-muted-foreground flex items-center justify-center gap-1.5">
                <a href="/my?tab=posts" class="hover:text-primary transition-colors">내글</a>
                <span class="text-border">·</span>
                <a href="/my?tab=comments" class="hover:text-primary transition-colors">내댓글</a>
                <span class="text-border">·</span>
                <a href="/my?tab=liked" class="hover:text-primary transition-colors">전체</a>
                <span class="text-border">·</span>
                <a href="/my?tab=stats" class="hover:text-primary transition-colors">분석</a>
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
                로그인/가입
            </Button>
        </div>
    {/if}
</div>
