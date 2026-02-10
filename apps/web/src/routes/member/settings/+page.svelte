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
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import type { PageData } from './$types.js';
    import { enhance } from '$app/forms';

    let { data }: { data: PageData } = $props();

    let profiles = $state(data.socialProfiles);
    let disconnecting = $state<number | null>(null);
    let error = $state<string | null>(null);

    // 폼 상태
    let nickSuccess = $state<string | null>(null);
    let nickError = $state<string | null>(null);
    let emailSuccess = $state<string | null>(null);
    let emailError = $state<string | null>(null);
    let pwSuccess = $state<string | null>(null);
    let pwError = $state<string | null>(null);
    let profileSuccess = $state<string | null>(null);
    let profileError = $state<string | null>(null);

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
</script>

<svelte:head>
    <title>회원 설정 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
    <div class="mb-6 flex items-center gap-3">
        <Settings class="h-6 w-6" />
        <h1 class="text-foreground text-2xl font-bold">회원 설정</h1>
    </div>

    <div class="space-y-6">
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

            <!-- 2. 비밀번호 변경 카드 -->
            <Card>
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <KeyRound class="h-5 w-5" />
                        비밀번호 변경
                    </CardTitle>
                    <CardDescription
                        >비밀번호를 변경합니다. 소셜 로그인으로만 가입한 경우 현재 비밀번호가 없을
                        수 있습니다.</CardDescription
                    >
                </CardHeader>
                <CardContent>
                    <form
                        method="POST"
                        action="?/changePassword"
                        use:enhance={() => {
                            pwSuccess = null;
                            pwError = null;
                            return async ({ result, update }) => {
                                if (result.type === 'success') {
                                    pwSuccess = '비밀번호가 변경되었습니다.';
                                    update({ reset: true });
                                } else if (result.type === 'failure') {
                                    pwError =
                                        (result.data?.error as string) || '변경에 실패했습니다.';
                                }
                            };
                        }}
                        class="space-y-4"
                    >
                        <div class="space-y-2">
                            <Label for="currentPassword">현재 비밀번호</Label>
                            <Input
                                id="currentPassword"
                                name="currentPassword"
                                type="password"
                                placeholder="현재 비밀번호"
                                autocomplete="current-password"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="newPassword">새 비밀번호</Label>
                            <Input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                placeholder="새 비밀번호 (4자 이상)"
                                autocomplete="new-password"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="confirmPassword">새 비밀번호 확인</Label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                placeholder="새 비밀번호 확인"
                                autocomplete="new-password"
                            />
                        </div>
                        {#if pwSuccess}
                            <p class="flex items-center gap-1 text-xs text-green-600">
                                <CircleCheck class="h-3 w-3" />{pwSuccess}
                            </p>
                        {/if}
                        {#if pwError}
                            <p class="flex items-center gap-1 text-xs text-red-600">
                                <CircleAlert class="h-3 w-3" />{pwError}
                            </p>
                        {/if}
                        <Button type="submit">비밀번호 변경</Button>
                    </form>
                </CardContent>
            </Card>

            <!-- 3. 설정 카드 -->
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
