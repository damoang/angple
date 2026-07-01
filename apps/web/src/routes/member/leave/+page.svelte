<script lang="ts">
    import { page } from '$app/state';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import { enhance } from '$app/forms';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    let agreed = $state(false);
    let errorMsg = $state<string | null>(null);
    let submitting = $state(false);
</script>

<svelte:head>
    <title>회원 탈퇴 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-8">
    <Card class="border-destructive/30">
        <CardHeader>
            <CardTitle class="flex items-center gap-2 text-red-600">
                <TriangleAlert class="h-5 w-5" />
                회원 탈퇴 안내
            </CardTitle>
            <CardDescription>탈퇴를 신청하시기 전에 아래 내용을 확인해주세요.</CardDescription>
        </CardHeader>
        <CardContent>
            <!-- 탈퇴 숙려기간(30일) 고지문 -->
            <div
                class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
            >
                <ul class="space-y-2">
                    <li>
                        - 탈퇴를 신청하시면 계정이 즉시 비활성화되어, 게시글·댓글이 더 이상 표시되지
                        않습니다.
                    </li>
                    <li>
                        - 신청일로부터 30일 이내에 다시 로그인하시면 언제든 탈퇴를 취소하고 원래대로
                        복구하실 수 있습니다.
                    </li>
                    <li>
                        - 30일이 지나면 탈퇴가 확정되며, 회원정보는 익명 처리됩니다. 단, 부정 이용
                        및 중복가입 방지를 위한 최소한의 식별정보는 관련 법령·개인정보처리방침에
                        따라 일정 기간 보관 후 파기됩니다.
                    </li>
                    <li>
                        - 이용제한(제재)이 적용 중인 경우, 탈퇴하거나 취소하더라도 제재 이력은
                        유지되며 탈퇴로 제재를 회피할 수 없습니다.
                    </li>
                </ul>
            </div>

            <form
                method="POST"
                use:enhance={() => {
                    submitting = true;
                    errorMsg = null;
                    return async ({ result, update }) => {
                        submitting = false;
                        if (result.type === 'failure') {
                            errorMsg =
                                (result.data?.error as string) || '탈퇴 처리에 실패했습니다.';
                        } else {
                            // 성공(리다이렉트) 등은 기본 처리에 위임
                            await update();
                        }
                    };
                }}
                class="space-y-4"
            >
                <input type="hidden" name="_csrf" value={page.data.csrfToken ?? ''} />

                <div class="flex items-start gap-2">
                    <Checkbox id="agree" name="agree" bind:checked={agreed} class="mt-0.5" />
                    <Label for="agree" class="cursor-pointer text-sm leading-relaxed">
                        위 내용을 확인하였으며 탈퇴에 동의합니다.
                    </Label>
                </div>

                {#if errorMsg}
                    <p class="flex items-center gap-1 text-sm text-red-600">
                        <CircleAlert class="h-4 w-4" />{errorMsg}
                    </p>
                {/if}

                <div class="flex gap-3">
                    <Button variant="outline" href="/member/settings" class="flex-1">취소</Button>
                    <Button
                        type="submit"
                        variant="destructive"
                        class="flex-1"
                        disabled={!agreed || submitting}
                    >
                        {submitting ? '처리 중...' : '회원 탈퇴 신청'}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>
</div>
