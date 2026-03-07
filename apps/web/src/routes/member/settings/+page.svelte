<script lang="ts">
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Separator } from '$lib/components/ui/separator/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Unlink from '@lucide/svelte/icons/unlink';
    import Link from '@lucide/svelte/icons/link';
    import Settings from '@lucide/svelte/icons/settings';
    import User from '@lucide/svelte/icons/user';
    import Mail from '@lucide/svelte/icons/mail';
    import KeyRound from '@lucide/svelte/icons/key-round';
    import Globe from '@lucide/svelte/icons/globe';
    import Camera from '@lucide/svelte/icons/camera';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import Coins from '@lucide/svelte/icons/coins';
    import Star from '@lucide/svelte/icons/star';
    import Ban from '@lucide/svelte/icons/ban';
    import Bookmark from '@lucide/svelte/icons/bookmark';
    import Monitor from '@lucide/svelte/icons/monitor';
    import type { PageData } from './$types.js';
    import { enhance } from '$app/forms';
    import { getAvatarUrl } from '$lib/utils/member-icon';

    const navItems = [
        { href: '/my', label: '마이페이지', icon: User },
        { href: '/my/points', label: '포인트', icon: Coins },
        { href: '/my/exp', label: '경험치', icon: Star },
        { href: '/my/blocked', label: '차단 목록', icon: Ban },
        { href: '/my/scraps', label: '스크랩', icon: Bookmark },
        { href: '/member/settings', label: '설정', icon: Settings },
        { href: '/member/settings/ui', label: '화면 설정', icon: Monitor }
    ];

    let { data }: { data: PageData } = $props();

    let profiles = $state([] as typeof data.socialProfiles);

    $effect(() => {
        profiles = data.socialProfiles;
    });
    let disconnecting = $state<number | null>(null);
    let error = $state<string | null>(null);

    // 폼 상태
    let nickSuccess = $state<string | null>(null);
    let nickError = $state<string | null>(null);
    let emailSuccess = $state<string | null>(null);
    let emailError = $state<string | null>(null);
    let profileSuccess = $state<string | null>(null);
    let profileError = $state<string | null>(null);

    // 아바타 상태
    let avatarUploading = $state(false);
    let avatarSuccess = $state<string | null>(null);
    let avatarError = $state<string | null>(null);
    let currentAvatarUrl = $state(
        data.profile?.mb_image_url ? getAvatarUrl(data.profile.mb_image_url) : null
    );
    let avatarFormRef = $state<HTMLFormElement | null>(null);
    let avatarUrlInput = $state('');

    let fileInputRef = $state<HTMLInputElement | null>(null);

    async function handleAvatarFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        // 파일 크기 체크 (5MB)
        if (file.size > 5 * 1024 * 1024) {
            avatarError = '파일 크기는 5MB 이하여야 합니다.';
            return;
        }

        // 이미지 타입 체크
        if (!file.type.startsWith('image/')) {
            avatarError = '이미지 파일만 업로드 가능합니다.';
            return;
        }

        avatarUploading = true;
        avatarError = null;
        avatarSuccess = null;

        try {
            // S3 업로드
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/media/images', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.error || '업로드에 실패했습니다.');
            }

            const result = await res.json();
            const uploadedUrl = result.url || result.cdnUrl;
            if (!uploadedUrl) throw new Error('업로드 URL을 받지 못했습니다.');

            // form action으로 DB 업데이트
            avatarUrlInput = uploadedUrl;

            // 약간의 딜레이 후 폼 제출 (state 반영 대기)
            await new Promise((r) => setTimeout(r, 50));
            avatarFormRef?.requestSubmit();
        } catch (err) {
            avatarError = err instanceof Error ? err.message : '업로드에 실패했습니다.';
            avatarUploading = false;
        }

        // input 리셋
        input.value = '';
    }

    const providerNames: Record<string, string> = {
        google: 'Google',
        kakao: '카카오',
        naver: '네이버',
        apple: 'Apple',
        facebook: 'Facebook',
        twitter: 'X (Twitter)',
        payco: 'PAYCO'
    };

    const providerColors: Record<string, string> = {
        google: 'bg-white text-gray-700 border',
        kakao: 'bg-[#FEE500] text-[#191919]',
        naver: 'bg-[#03C75A] text-white',
        apple: 'bg-black text-white',
        facebook: 'bg-[#1877F2] text-white',
        twitter: 'bg-black text-white',
        payco: 'bg-[#E42529] text-white'
    };

    async function disconnectSocial(mpNo: number): Promise<void> {
        if (disconnecting) return;

        if (!confirm('이 소셜 계정 연결을 해제하시겠습니까?')) return;

        disconnecting = mpNo;
        error = null;

        try {
            const response = await fetch('/member/settings/social', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mp_no: mpNo })
            });

            const result = await response.json();

            if (result.success) {
                profiles = profiles.filter((p) => p.mpNo !== mpNo);
            } else {
                error = result.error || '해제에 실패했습니다.';
            }
        } catch {
            error = '요청 중 오류가 발생했습니다.';
        } finally {
            disconnecting = null;
        }
    }

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // 실명인증
    let certCompleted = $state(data.certCompleted);

    function openCertPopup() {
        const width = 500;
        const height = 620;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        window.open(
            '/cert/inicis?pageType=settings',
            'sa_popup',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );
    }

    function handleCertMessage(event: MessageEvent) {
        if (event.data?.type === 'cert_result' && event.data.data?.success) {
            certCompleted = true;
        }
    }

    import { onMount, onDestroy } from 'svelte';

    onMount(() => {
        window.addEventListener('message', handleCertMessage);
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('message', handleCertMessage);
        }
    });
</script>

<svelte:head>
    <title>회원 설정 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 pt-4">
    <!-- 마이페이지 공통 네비게이션 -->
    <nav class="mb-6 overflow-x-auto">
        <div class="flex gap-1">
            {#each navItems as item (item.href)}
                {@const active = item.href === '/member/settings'}
                <a href={item.href} class="shrink-0" data-sveltekit-preload-data="hover">
                    <Button variant={active ? 'default' : 'ghost'} size="sm">
                        <item.icon class="mr-1.5 h-4 w-4" />
                        {item.label}
                    </Button>
                </a>
            {/each}
        </div>
    </nav>
</div>

<div class="mx-auto max-w-2xl px-4 pb-8">
    <div class="space-y-6">
        <!-- 0. 프로필 사진 카드 -->
        {#if data.profile}
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Camera class="h-5 w-5" />
                        프로필 사진
                    </CardTitle>
                    <CardDescription
                        >프로필 사진을 변경합니다. (5MB 이하, 이미지 파일)</CardDescription
                    >
                </CardHeader>
                <CardContent>
                    <div class="flex items-center gap-6">
                        <!-- 현재 아바타 -->
                        <div class="relative">
                            <div
                                class="bg-primary/10 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full"
                            >
                                {#if currentAvatarUrl}
                                    <img
                                        src={currentAvatarUrl}
                                        alt="프로필 사진"
                                        class="h-full w-full object-cover"
                                        onerror={() => {
                                            currentAvatarUrl = null;
                                        }}
                                    />
                                {:else}
                                    <User class="text-primary h-10 w-10" />
                                {/if}
                            </div>
                            {#if avatarUploading}
                                <div
                                    class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40"
                                >
                                    <Loader2 class="h-6 w-6 animate-spin text-white" />
                                </div>
                            {/if}
                        </div>

                        <div class="space-y-2">
                            <input
                                bind:this={fileInputRef}
                                type="file"
                                accept="image/*"
                                class="hidden"
                                onchange={handleAvatarFileChange}
                            />
                            <Button
                                variant="outline"
                                onclick={() => fileInputRef?.click()}
                                disabled={avatarUploading}
                            >
                                {#if avatarUploading}
                                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                    업로드 중...
                                {:else}
                                    <Camera class="mr-2 h-4 w-4" />
                                    사진 변경
                                {/if}
                            </Button>

                            {#if currentAvatarUrl}
                                <form
                                    method="POST"
                                    action="?/updateAvatar"
                                    use:enhance={() => {
                                        avatarSuccess = null;
                                        avatarError = null;
                                        return async ({ result }) => {
                                            if (result.type === 'success') {
                                                avatarSuccess = '프로필 사진이 삭제되었습니다.';
                                                currentAvatarUrl = null;
                                            } else if (result.type === 'failure') {
                                                avatarError =
                                                    (result.data?.error as string) ||
                                                    '삭제에 실패했습니다.';
                                            }
                                        };
                                    }}
                                >
                                    <input type="hidden" name="avatar_url" value="" />
                                    <Button
                                        type="submit"
                                        variant="ghost"
                                        size="sm"
                                        class="text-muted-foreground"
                                    >
                                        사진 삭제
                                    </Button>
                                </form>
                            {/if}

                            {#if avatarSuccess}
                                <p class="flex items-center gap-1 text-xs text-green-600">
                                    <CircleCheck class="h-3 w-3" />{avatarSuccess}
                                </p>
                            {/if}
                            {#if avatarError}
                                <p class="flex items-center gap-1 text-xs text-red-600">
                                    <CircleAlert class="h-3 w-3" />{avatarError}
                                </p>
                            {/if}
                        </div>
                    </div>

                    <!-- 숨겨진 폼: S3 업로드 후 DB 업데이트용 -->
                    <form
                        bind:this={avatarFormRef}
                        method="POST"
                        action="?/updateAvatar"
                        class="hidden"
                        use:enhance={() => {
                            return async ({ result }) => {
                                avatarUploading = false;
                                if (result.type === 'success') {
                                    avatarSuccess = '프로필 사진이 변경되었습니다.';
                                    currentAvatarUrl = avatarUrlInput;
                                } else if (result.type === 'failure') {
                                    avatarError =
                                        (result.data?.error as string) || '저장에 실패했습니다.';
                                }
                            };
                        }}
                    >
                        <input type="hidden" name="avatar_url" value={avatarUrlInput} />
                    </form>
                </CardContent>
            </Card>
        {/if}

        <!-- 1. 기본 정보 카드 -->
        {#if data.profile}
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <User class="h-5 w-5" />
                        기본 정보
                    </CardTitle>
                    <CardDescription>닉네임과 이메일을 변경할 수 있습니다.</CardDescription>
                </CardHeader>
                <CardContent class="space-y-6">
                    <!-- 닉네임 변경 -->
                    <form
                        method="POST"
                        action="?/updateNickname"
                        use:enhance={() => {
                            nickSuccess = null;
                            nickError = null;
                            return async ({ result }) => {
                                if (result.type === 'success') {
                                    nickSuccess = '닉네임이 변경되었습니다.';
                                } else if (result.type === 'failure') {
                                    nickError =
                                        (result.data?.error as string) || '변경에 실패했습니다.';
                                }
                            };
                        }}
                    >
                        <div class="space-y-2">
                            <Label for="nickname">닉네임</Label>
                            <div class="flex gap-2">
                                <Input
                                    id="nickname"
                                    name="nickname"
                                    value={data.profile.mb_nick}
                                    placeholder="닉네임"
                                    disabled={data.nickChangeDaysLeft > 0}
                                />
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={data.nickChangeDaysLeft > 0}
                                >
                                    변경
                                </Button>
                            </div>
                            {#if data.nickChangeDaysLeft > 0}
                                <p class="text-muted-foreground text-xs">
                                    {data.nickChangeDaysLeft}일 후 변경 가능 (30일에 1회)
                                </p>
                            {/if}
                            {#if nickSuccess}
                                <p class="flex items-center gap-1 text-xs text-green-600">
                                    <CircleCheck class="h-3 w-3" />{nickSuccess}
                                </p>
                            {/if}
                            {#if nickError}
                                <p class="flex items-center gap-1 text-xs text-red-600">
                                    <CircleAlert class="h-3 w-3" />{nickError}
                                </p>
                            {/if}
                        </div>
                    </form>

                    <Separator />

                    <!-- 이메일 변경 -->
                    <form
                        method="POST"
                        action="?/updateEmail"
                        use:enhance={() => {
                            emailSuccess = null;
                            emailError = null;
                            return async ({ result }) => {
                                if (result.type === 'success') {
                                    emailSuccess = '이메일이 변경되었습니다.';
                                } else if (result.type === 'failure') {
                                    emailError =
                                        (result.data?.error as string) || '변경에 실패했습니다.';
                                }
                            };
                        }}
                    >
                        <div class="space-y-2">
                            <Label for="email">이메일</Label>
                            <div class="flex gap-2">
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={data.profile.mb_email}
                                    placeholder="이메일"
                                />
                                <Button type="submit" variant="outline">변경</Button>
                            </div>
                            {#if emailSuccess}
                                <p class="flex items-center gap-1 text-xs text-green-600">
                                    <CircleCheck class="h-3 w-3" />{emailSuccess}
                                </p>
                            {/if}
                            {#if emailError}
                                <p class="flex items-center gap-1 text-xs text-red-600">
                                    <CircleAlert class="h-3 w-3" />{emailError}
                                </p>
                            {/if}
                        </div>
                    </form>
                </CardContent>
            </Card>

            <!-- 설정 카드 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <Globe class="h-5 w-5" />
                        추가 설정
                    </CardTitle>
                    <CardDescription>홈페이지, 서명, 프로필 공개 등을 설정합니다.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        method="POST"
                        action="?/updateProfile"
                        use:enhance={() => {
                            profileSuccess = null;
                            profileError = null;
                            return async ({ result }) => {
                                if (result.type === 'success') {
                                    profileSuccess = '설정이 저장되었습니다.';
                                } else if (result.type === 'failure') {
                                    profileError =
                                        (result.data?.error as string) || '저장에 실패했습니다.';
                                }
                            };
                        }}
                        class="space-y-4"
                    >
                        <div class="space-y-2">
                            <Label for="homepage">홈페이지</Label>
                            <Input
                                id="homepage"
                                name="homepage"
                                type="url"
                                value={data.profile.mb_homepage}
                                placeholder="https://example.com"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="signature">서명</Label>
                            <Textarea
                                id="signature"
                                name="signature"
                                value={data.profile.mb_signature}
                                placeholder="서명을 입력하세요 (255자 이내)"
                                rows={3}
                            />
                        </div>
                        <div class="flex items-center justify-between">
                            <div>
                                <Label for="open">프로필 공개</Label>
                                <p class="text-muted-foreground text-xs">
                                    다른 회원에게 프로필을 공개합니다
                                </p>
                            </div>
                            <Switch id="open" name="open" checked={data.profile.mb_open === 1} />
                        </div>
                        <div class="flex items-center justify-between">
                            <div>
                                <Label for="mailling">메일링 수신</Label>
                                <p class="text-muted-foreground text-xs">
                                    이메일 뉴스레터를 수신합니다
                                </p>
                            </div>
                            <Switch
                                id="mailling"
                                name="mailling"
                                checked={data.profile.mb_mailling === 1}
                            />
                        </div>
                        {#if profileSuccess}
                            <p class="flex items-center gap-1 text-xs text-green-600">
                                <CircleCheck class="h-3 w-3" />{profileSuccess}
                            </p>
                        {/if}
                        {#if profileError}
                            <p class="flex items-center gap-1 text-xs text-red-600">
                                <CircleAlert class="h-3 w-3" />{profileError}
                            </p>
                        {/if}
                        <Button type="submit">설정 저장</Button>
                    </form>
                </CardContent>
            </Card>
        {/if}

        <!-- 4. 소셜 계정 관리 -->
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Link class="h-5 w-5" />
                    연결된 소셜 계정
                </CardTitle>
                <CardDescription>소셜 로그인에 사용되는 계정을 관리합니다.</CardDescription>
            </CardHeader>
            <CardContent>
                {#if error}
                    <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                        {error}
                    </div>
                {/if}

                {#if profiles.length === 0}
                    <p class="text-muted-foreground py-4 text-center text-sm">
                        연결된 소셜 계정이 없습니다.
                    </p>
                {:else}
                    <div class="space-y-3">
                        {#each profiles as profile (profile.mpNo)}
                            <div
                                class="border-border flex items-center justify-between rounded-lg border p-4"
                            >
                                <div class="flex items-center gap-3">
                                    <Badge
                                        class="px-3 py-1 {providerColors[profile.provider] ||
                                            'bg-gray-100'}"
                                    >
                                        {providerNames[profile.provider] || profile.provider}
                                    </Badge>
                                    <div>
                                        {#if profile.displayname}
                                            <p class="text-foreground text-sm font-medium">
                                                {profile.displayname}
                                            </p>
                                        {/if}
                                        <p class="text-muted-foreground text-xs">
                                            연결일: {formatDate(profile.registeredAt)}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => disconnectSocial(profile.mpNo)}
                                    disabled={disconnecting !== null}
                                >
                                    {#if disconnecting === profile.mpNo}
                                        <Loader2 class="mr-1 h-4 w-4 animate-spin" />
                                    {:else}
                                        <Unlink class="mr-1 h-4 w-4" />
                                    {/if}
                                    해제
                                </Button>
                            </div>
                        {/each}
                    </div>
                {/if}

                <Separator class="my-4" />

                <div>
                    <p class="text-muted-foreground mb-3 text-sm">
                        새 소셜 계정을 연결하려면 해당 서비스로 로그인하세요.
                    </p>
                    <Button variant="outline" href="/login?redirect=/member/settings">
                        <Link class="mr-2 h-4 w-4" />
                        소셜 계정 추가 연결
                    </Button>
                </div>
            </CardContent>
        </Card>

        <!-- 5. 본인인증 -->
        {#if data.certEnabled}
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <ShieldCheck class="h-5 w-5" />
                        본인인증
                    </CardTitle>
                    <CardDescription>
                        본인인증을 완료하면 글쓰기, 댓글, 추천 등 모든 기능을 이용할 수 있습니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {#if certCompleted}
                        <div
                            class="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950"
                        >
                            <div
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
                            >
                                <ShieldCheck class="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p class="font-medium text-green-800 dark:text-green-200">
                                    본인인증 완료
                                </p>
                                <p class="text-sm text-green-600 dark:text-green-400">
                                    모든 기능을 이용할 수 있습니다.
                                </p>
                            </div>
                        </div>
                    {:else}
                        <div class="space-y-4">
                            <div
                                class="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950"
                            >
                                <div
                                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900"
                                >
                                    <CircleAlert
                                        class="h-5 w-5 text-yellow-600 dark:text-yellow-400"
                                    />
                                </div>
                                <div>
                                    <p class="font-medium text-yellow-800 dark:text-yellow-200">
                                        본인인증이 필요합니다
                                    </p>
                                    <p class="text-sm text-yellow-600 dark:text-yellow-400">
                                        인증 전에는 글쓰기, 댓글, 추천, 신고 기능이 제한됩니다.
                                    </p>
                                </div>
                            </div>
                            <Button onclick={openCertPopup}>
                                <ShieldCheck class="mr-2 h-4 w-4" />
                                간편인증 하기
                            </Button>
                        </div>
                    {/if}
                </CardContent>
            </Card>
        {/if}

        <!-- 회원 탈퇴 링크 -->
        <div class="text-center">
            <a
                href="/member/leave"
                class="text-muted-foreground text-sm underline hover:text-red-600"
            >
                회원 탈퇴
            </a>
        </div>
    </div>
</div>
