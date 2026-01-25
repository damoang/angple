<script lang="ts">
    import { enhance } from '$app/forms';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Textarea } from '$lib/components/ui/textarea';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';

    /**
     * 설치 위저드 Step 1: 사이트 정보 입력
     */

    let isSubmitting = $state(false);
</script>

<svelte:head>
    <title>Angple 설치 - Step 1</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <div class="mb-4 text-4xl font-bold">Angple</div>
            <CardTitle class="text-2xl">사이트 설정</CardTitle>
            <CardDescription>
                Angple에 오신 것을 환영합니다. 사이트 기본 정보를 입력해주세요.
            </CardDescription>
        </CardHeader>

        <CardContent>
            <!-- 진행 상태 표시 (4단계) -->
            <div class="mb-8 flex items-center justify-center gap-2">
                <div
                    class="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    1
                </div>
                <div class="bg-muted-foreground/30 h-0.5 w-8"></div>
                <div
                    class="bg-muted-foreground/30 text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    2
                </div>
                <div class="bg-muted-foreground/30 h-0.5 w-8"></div>
                <div
                    class="bg-muted-foreground/30 text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    3
                </div>
                <div class="bg-muted-foreground/30 h-0.5 w-8"></div>
                <div
                    class="bg-muted-foreground/30 text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    4
                </div>
            </div>

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
                        <Label for="siteName">사이트 이름 *</Label>
                        <Input
                            id="siteName"
                            name="siteName"
                            placeholder="My Angple Site"
                            required
                        />
                        <p class="text-muted-foreground text-sm">사이트 제목으로 표시됩니다.</p>
                    </div>

                    <div class="space-y-2">
                        <Label for="siteDescription">사이트 설명</Label>
                        <Textarea
                            id="siteDescription"
                            name="siteDescription"
                            placeholder="나만의 커뮤니티를 만들어보세요"
                            rows={3}
                        />
                        <p class="text-muted-foreground text-sm">
                            사이트에 대한 간단한 설명입니다.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <Label for="siteUrl">사이트 URL</Label>
                        <Input
                            id="siteUrl"
                            name="siteUrl"
                            type="url"
                            placeholder="https://example.com"
                        />
                        <p class="text-muted-foreground text-sm">
                            사이트의 접속 주소입니다. (선택사항)
                        </p>
                    </div>
                </div>

                <div class="mt-8 flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '처리 중...' : '다음 단계'}
                    </Button>
                </div>
            </form>
        </CardContent>
    </Card>
</div>
