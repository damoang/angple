<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Check from '@lucide/svelte/icons/check';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import Link from '@lucide/svelte/icons/link';

    interface Props {
        data: { token: string };
    }

    let { data }: Props = $props();

    const SOCIAL_PROVIDERS = [
        {
            id: 'kakao',
            label: '카카오로 로그인',
            bgClass: 'bg-[#FEE500]',
            textClass: 'text-[#191919]',
            hoverClass: 'hover:bg-[#FEE500]/90'
        },
        {
            id: 'naver',
            label: '네이버로 로그인',
            bgClass: 'bg-[#03C75A]',
            textClass: 'text-white',
            hoverClass: 'hover:bg-[#03C75A]/90'
        },
        {
            id: 'google',
            label: 'Google로 로그인',
            bgClass: 'bg-white border border-border',
            textClass: 'text-gray-700',
            hoverClass: 'hover:bg-gray-50'
        }
    ] as const;

    let loading = $state(true);
    let error = $state<string | null>(null);
    let confirming = $state(false);
    let success = $state(false);

    let inviteInfo = $state<{
        target_mb_id: string;
        target_mb_nick: string;
        expires_at: string;
        current_user_mb_id?: string;
        current_user_mb_nick?: string;
        current_socials?: { provider: string; social_name: string }[];
    } | null>(null);

    function getProviderLabel(provider: string): string {
        const labels: Record<string, string> = {
            naver: '네이버',
            kakao: '카카오',
            google: '구글',
            apple: '애플'
        };
        return labels[provider] || provider;
    }

    function buildAuthStartUrl(provider: string): string {
        const redirect = `/invite/${data.token}`;
        return `/auth/start?provider=${encodeURIComponent(provider)}&redirect=${encodeURIComponent(redirect)}`;
    }

    async function loadInviteInfo() {
        loading = true;
        error = null;
        try {
            const res = await fetch(`/api/v1/social-invite/${data.token}`, {
                credentials: 'include'
            });
            const json = await res.json();
            if (!res.ok || json.error) {
                error = json.error?.message || json.message || '초대 정보를 불러올 수 없습니다';
                return;
            }
            inviteInfo = json.data;
        } catch {
            error = '초대 정보를 불러올 수 없습니다';
        } finally {
            loading = false;
        }
    }

    async function confirmInvite() {
        if (confirming || !inviteInfo?.current_user_mb_id) return;

        confirming = true;
        error = null;
        try {
            const res = await fetch(`/api/v1/social-invite/${data.token}/confirm`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await res.json();
            if (!res.ok || json.error) {
                error = json.error?.message || json.message || '처리에 실패했습니다';
                return;
            }
            success = true;
        } catch {
            error = '요청 처리에 실패했습니다';
        } finally {
            confirming = false;
        }
    }

    onMount(() => {
        if (browser) {
            loadInviteInfo();
        }
    });
</script>

<svelte:head>
    <title>소셜 로그인 연결 | {import.meta.env.VITE_SITE_NAME || '다모앙'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    {#if loading}
        <div class="space-y-4 text-center">
            <Loader2 class="mx-auto h-12 w-12 animate-spin text-blue-600" />
            <p class="text-muted-foreground">초대 정보를 불러오는 중...</p>
        </div>
    {:else if success}
        <Card class="w-full max-w-md">
            <CardContent class="flex flex-col items-center p-8">
                <div
                    class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50"
                >
                    <Check class="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 class="mb-2 text-xl font-bold">연결 완료</h2>
                <p class="text-muted-foreground text-center">소셜 로그인이 연결되었습니다.</p>
                <p class="text-muted-foreground mt-1 text-center text-sm">
                    이제 소셜 계정으로 로그인할 수 있습니다.
                </p>
            </CardContent>
        </Card>
    {:else if error && !inviteInfo}
        <Card class="w-full max-w-md">
            <CardContent class="flex flex-col items-center p-8">
                <div
                    class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50"
                >
                    <CircleAlert class="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <h2 class="mb-2 text-xl font-bold">오류</h2>
                <p class="text-muted-foreground text-center">{error}</p>
            </CardContent>
        </Card>
    {:else if inviteInfo && !inviteInfo.current_user_mb_id}
        <Card class="w-full max-w-md">
            <CardHeader class="text-center">
                <div
                    class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50"
                >
                    <Link class="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle class="text-xl">소셜 로그인 연결</CardTitle>
            </CardHeader>
            <CardContent class="space-y-6">
                <div class="bg-muted/50 rounded-md p-4 text-center">
                    <p class="text-muted-foreground text-sm">대상 계정</p>
                    <p class="text-lg font-bold">{inviteInfo.target_mb_id}</p>
                    {#if inviteInfo.target_mb_nick}
                        <p class="text-muted-foreground text-sm">({inviteInfo.target_mb_nick})</p>
                    {/if}
                </div>

                <p class="text-muted-foreground text-center text-sm">
                    아래 소셜 계정으로 로그인하면 해당 계정에 연결됩니다.
                </p>

                <div class="space-y-2.5">
                    {#each SOCIAL_PROVIDERS as provider (provider.id)}
                        <button
                            class="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-[0.98] {provider.bgClass} {provider.textClass} {provider.hoverClass}"
                            onclick={() => {
                                window.location.href = buildAuthStartUrl(provider.id);
                            }}
                        >
                            {#if provider.id === 'kakao'}
                                <svg class="h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#191919"
                                        d="M12 3c-5.065 0-9.167 3.355-9.167 7.5 0 2.625 1.757 4.937 4.403 6.278-.193.705-.7 2.555-.804 2.953-.127.497.182.49.385.357.159-.104 2.534-1.72 3.565-2.42.514.073 1.047.112 1.618.112 5.065 0 9.167-3.355 9.167-7.5S17.065 3 12 3"
                                    />
                                </svg>
                            {:else if provider.id === 'naver'}
                                <svg class="h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        fill="white"
                                        d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"
                                    />
                                </svg>
                            {:else if provider.id === 'google'}
                                <svg class="h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        fill="#4285F4"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="#34A853"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="#FBBC05"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="#EA4335"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                            {/if}
                            {provider.label}
                        </button>
                    {/each}
                </div>
            </CardContent>
        </Card>
    {:else if inviteInfo}
        <Card class="w-full max-w-md">
            <CardHeader class="text-center">
                <div
                    class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50"
                >
                    <Link class="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle class="text-xl">소셜 연결 확인</CardTitle>
            </CardHeader>
            <CardContent class="space-y-6">
                {#if error}
                    <div
                        class="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400"
                    >
                        {error}
                    </div>
                {/if}

                {#if inviteInfo.current_socials && inviteInfo.current_socials.length > 0}
                    <div class="bg-muted/50 rounded-md p-4">
                        <p class="mb-2 text-sm font-medium">현재 소셜 로그인</p>
                        {#each inviteInfo.current_socials as social (social.provider)}
                            <div class="flex items-center gap-2 text-sm">
                                <span
                                    class="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                                >
                                    {getProviderLabel(social.provider)}
                                </span>
                                <span class="text-muted-foreground"
                                    >{social.social_name || '(이름 없음)'}</span
                                >
                            </div>
                        {/each}
                    </div>
                {/if}

                <div class="rounded-md bg-blue-50 p-4 dark:bg-blue-950/30">
                    <p class="mb-1 text-sm font-medium">대상 계정</p>
                    <p class="text-lg font-bold">{inviteInfo.target_mb_id}</p>
                    {#if inviteInfo.target_mb_nick}
                        <p class="text-muted-foreground text-sm">({inviteInfo.target_mb_nick})</p>
                    {/if}
                </div>

                <p class="text-muted-foreground text-sm">
                    위 소셜 계정을 대상 계정에 연결하시겠습니까?
                </p>

                <div class="flex gap-3">
                    <Button
                        variant="outline"
                        class="flex-1"
                        onclick={() => {
                            window.location.href = '/';
                        }}
                    >
                        취소
                    </Button>
                    <Button class="flex-1" onclick={confirmInvite} disabled={confirming}>
                        {#if confirming}
                            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                            처리중...
                        {:else}
                            연결 확인
                        {/if}
                    </Button>
                </div>
            </CardContent>
        </Card>
    {/if}
</div>
