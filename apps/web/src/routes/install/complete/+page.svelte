<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { CheckCircle } from '@lucide/svelte/icons';

    /**
     * 설치 위저드 완료 화면
     */
</script>

<svelte:head>
    <title>Angple 설치 완료</title>
</svelte:head>

<div class="bg-muted flex min-h-screen items-center justify-center p-4">
    <Card class="w-full max-w-lg">
        <CardHeader class="text-center">
            <div class="mb-4 flex justify-center">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle class="h-10 w-10 text-green-600" />
                </div>
            </div>
            <CardTitle class="text-2xl">설치 완료!</CardTitle>
            <CardDescription>Angple이 성공적으로 설치되었습니다.</CardDescription>
        </CardHeader>

        <CardContent>
            <!-- 진행 상태 표시 (4단계) -->
            <div class="mb-8 flex items-center justify-center gap-2">
                <div
                    class="bg-primary/50 text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    1
                </div>
                <div class="bg-primary h-0.5 w-8"></div>
                <div
                    class="bg-primary/50 text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    2
                </div>
                <div class="bg-primary h-0.5 w-8"></div>
                <div
                    class="bg-primary/50 text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    3
                </div>
                <div class="bg-primary h-0.5 w-8"></div>
                <div
                    class="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                >
                    4
                </div>
            </div>

            <div class="bg-muted-foreground/10 mb-6 rounded-lg p-4">
                <h3 class="mb-2 font-semibold">다음 단계</h3>
                <ul class="text-muted-foreground space-y-2 text-sm">
                    <li>1. 관리자 대시보드에서 테마를 선택하세요.</li>
                    <li>2. 사이트 설정을 커스터마이즈하세요.</li>
                    <li>3. 콘텐츠를 추가하고 사이트를 운영하세요.</li>
                </ul>
            </div>

            <div class="flex flex-col gap-3">
                <Button href="/admin/dashboard" class="w-full">관리자 대시보드로 이동</Button>
                <Button href="/" variant="outline" class="w-full">사이트 홈으로 이동</Button>
            </div>
        </CardContent>
    </Card>
</div>
