<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { StepIndicator } from '$lib/components/install';

    /**
     * 설치 위저드 Step 3: 관리자 계정 생성
     */

    let { form } = $props();
    let isSubmitting = $state(false);
</script>

<svelte:head>
    <title>Angple 설치 - Step 3</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <div class="mb-4 text-4xl font-bold">Angple</div>
            <CardTitle class="text-2xl">관리자 계정 생성</CardTitle>
            <CardDescription>
                관리자 계정을 생성합니다. 이 계정으로 사이트를 관리할 수 있습니다.
            </CardDescription>
        </CardHeader>

        <CardContent>
            <StepIndicator currentStep={3} />

            {#if form?.error}
                <div class="bg-destructive/10 text-destructive mb-4 rounded-md p-3 text-sm">
                    {form.error}
                </div>
            {/if}

            <form
                method="POST"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => {
                        await update();
                        isSubmitting = false;
                    };
                }}
            >
                <div class="space-y-4">
                    <div class="space-y-2">
                        <Label for="adminEmail">관리자 이메일 *</Label>
                        <Input
                            id="adminEmail"
                            name="adminEmail"
                            type="email"
                            placeholder="admin@example.com"
                            required
                        />
                    </div>

                    <div class="space-y-2">
                        <Label for="adminName">관리자 이름 *</Label>
                        <Input id="adminName" name="adminName" placeholder="관리자" required />
                    </div>

                    <div class="space-y-2">
                        <Label for="adminUsername">관리자 아이디 *</Label>
                        <Input id="adminUsername" name="adminUsername" placeholder="admin" required />
                        <p class="text-muted-foreground text-sm">로그인 시 사용할 아이디입니다.</p>
                    </div>

                    <div class="space-y-2">
                        <Label for="adminPassword">비밀번호 *</Label>
                        <Input
                            id="adminPassword"
                            name="adminPassword"
                            type="password"
                            placeholder="8자 이상 입력"
                            minlength={8}
                            required
                        />
                        <p class="text-muted-foreground text-sm">최소 8자 이상 입력해주세요.</p>
                    </div>

                    <div class="space-y-2">
                        <Label for="adminPasswordConfirm">비밀번호 확인 *</Label>
                        <Input
                            id="adminPasswordConfirm"
                            name="adminPasswordConfirm"
                            type="password"
                            placeholder="비밀번호 재입력"
                            minlength={8}
                            required
                        />
                    </div>
                </div>

                <div class="mt-8 flex justify-between">
                    <Button type="button" variant="outline" href="/install/step-2">이전</Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '처리 중...' : '설치 완료'}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>
</div>
