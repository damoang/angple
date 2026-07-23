<script lang="ts">
    import { enhance } from '$app/forms';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import type { PageData } from './$types.js';

    // 복원 폼은 /register 액션으로 보낸다(세션 생성 로직 재사용). 실패 시 그쪽에서
    // 에러를 표시하므로 이 페이지에는 form prop 이 없다.
    let { data }: { data: PageData } = $props();

    let isSubmitting = $state(false);

    const providerNames: Record<string, string> = {
        google: 'Google',
        kakao: '카카오',
        naver: '네이버',
        apple: 'Apple',
        facebook: 'Facebook',
        twitter: 'X (Twitter)',
        payco: 'PAYCO'
    };

    const providerLabel = $derived(providerNames[data.provider] || data.provider);
    const blocked = $derived(data.account.kind === 'blocked');
</script>

<svelte:head>
    <title>이전 계정 안내 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">
                {blocked ? '가입할 수 없습니다' : '이전 계정이 있습니다'}
            </CardTitle>
            <CardDescription>
                {#if blocked}
                    이 {providerLabel} 계정으로 만든 계정이 이용 제한 상태입니다
                {:else}
                    같은 {providerLabel} 계정으로 만드신 계정입니다
                {/if}
            </CardDescription>
        </CardHeader>

        <CardContent>
            {#if blocked}
                <div class="space-y-5">
                    <div
                        class="bg-destructive/10 text-destructive rounded-md p-4 text-sm leading-6"
                    >
                        <p>
                            이 소셜 계정으로 만들어진 계정이 현재 이용 제한 상태입니다. 새로
                            가입하실 수 없습니다.
                        </p>
                    </div>
                    <p class="text-muted-foreground text-sm leading-6">
                        문의가 필요하시면 고객센터로 연락해 주세요.
                    </p>
                    <Button href="/" variant="outline" class="w-full">돌아가기</Button>
                </div>
            {:else}
                <div class="space-y-5">
                    <div class="border-border bg-muted/40 rounded-lg border p-4 text-sm leading-6">
                        <p class="text-muted-foreground">
                            새로 가입하지 않으셔도 됩니다. 아래 계정으로 이어서 이용하실 수
                            있습니다.
                        </p>
                        <dl class="mt-4 space-y-1.5">
                            <div class="flex gap-3">
                                <dt class="text-muted-foreground w-20 shrink-0">닉네임</dt>
                                <dd class="font-medium">{data.account.nick}</dd>
                            </div>
                            {#if data.account.joinedAt}
                                <div class="flex gap-3">
                                    <dt class="text-muted-foreground w-20 shrink-0">가입일</dt>
                                    <dd>{data.account.joinedAt}</dd>
                                </div>
                            {/if}
                            <div class="flex gap-3">
                                <dt class="text-muted-foreground w-20 shrink-0">글·댓글</dt>
                                <dd>{data.account.postCount.toLocaleString()}건</dd>
                            </div>
                        </dl>
                    </div>

                    <form
                        method="POST"
                        action="/register"
                        use:enhance={() => {
                            isSubmitting = true;
                            return async ({ result, update }) => {
                                if (result.type !== 'redirect') {
                                    isSubmitting = false;
                                }
                                await update();
                            };
                        }}
                    >
                        <input type="hidden" name="intent" value="recover" />
                        <input type="hidden" name="redirect" value="/" />
                        <Button type="submit" class="w-full" disabled={isSubmitting}>
                            {#if isSubmitting}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                처리 중...
                            {:else}
                                이 계정으로 계속 이용하기
                            {/if}
                        </Button>
                    </form>

                    <p class="text-muted-foreground text-center text-xs leading-5">
                        본인 확인은 방금 로그인하신 {providerLabel} 계정으로 대신합니다.
                    </p>
                </div>
            {/if}
        </CardContent>
    </Card>
</div>
