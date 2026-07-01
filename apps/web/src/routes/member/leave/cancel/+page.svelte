<script lang="ts">
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import { enhance } from '$app/forms';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    let errorMsg = $state<string | null>(null);
    let submitting = $state<'cancel' | 'keep' | null>(null);
</script>

<svelte:head>
    <title>탈퇴 취소 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-8">
    <Card class="border-amber-300/50">
        <CardHeader>
            <CardTitle class="flex items-center gap-2 text-amber-600">
                <RotateCcw class="h-5 w-5" />
                현재 탈퇴 신청 상태입니다
            </CardTitle>
            <CardDescription>
                {data.nickname}님, 지금 취소하시면 계정과 모든 데이터가 그대로 복구됩니다.
            </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
            <div
                class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
                <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                    <dt class="text-muted-foreground">신청일</dt>
                    <dd class="font-medium">{data.leaveDate}</dd>
                    <dt class="text-muted-foreground">확정 예정일</dt>
                    <dd class="font-medium">{data.deadline}</dd>
                    <dt class="text-muted-foreground">남은 기간</dt>
                    <dd class="font-medium">{data.daysRemaining}일</dd>
                </dl>
            </div>

            {#if errorMsg}
                <p class="flex items-center gap-1 text-sm text-red-600">
                    <CircleAlert class="h-4 w-4" />{errorMsg}
                </p>
            {/if}

            <div class="flex flex-col gap-3 sm:flex-row">
                <form
                    method="POST"
                    action="?/cancel"
                    class="flex-1"
                    use:enhance={() => {
                        submitting = 'cancel';
                        errorMsg = null;
                        return async ({ result, update }) => {
                            if (result.type === 'failure') {
                                submitting = null;
                                errorMsg =
                                    (result.data?.error as string) || '탈퇴 취소에 실패했습니다.';
                            } else {
                                await update();
                            }
                        };
                    }}
                >
                    <Button type="submit" class="w-full" disabled={submitting !== null}>
                        {submitting === 'cancel' ? '처리 중...' : '탈퇴 취소하고 계속 이용하기'}
                    </Button>
                </form>

                <form
                    method="POST"
                    action="?/keep"
                    class="flex-1"
                    use:enhance={() => {
                        submitting = 'keep';
                        return async ({ update }) => {
                            await update();
                        };
                    }}
                >
                    <Button
                        type="submit"
                        variant="outline"
                        class="w-full"
                        disabled={submitting !== null}
                    >
                        {submitting === 'keep' ? '처리 중...' : '유지(로그아웃)'}
                    </Button>
                </form>
            </div>
        </CardContent>
    </Card>
</div>
