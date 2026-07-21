<script lang="ts">
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import Home from '@lucide/svelte/icons/home';
</script>

<svelte:head>
    <title>광고주 가입 완료</title>
</svelte:head>

<div class="mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4 py-12">
    <Card class="w-full">
        <CardHeader class="items-center text-center">
            <div
                class="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30"
            >
                <CircleCheck class="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle class="text-xl">가입이 완료되었습니다</CardTitle>
            <CardDescription>
                광고주 계정이 생성되었습니다.<br />
                프로모션 관리에서 광고를 설정하세요.
            </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
            <div class="border-border bg-muted/40 rounded-lg border p-4 text-sm leading-6">
                <p class="font-semibold">등급 안내</p>
                <p class="text-muted-foreground mt-2">
                    닉네임 오른쪽은 <span class="text-foreground font-medium">앙님❤️</span>으로
                    시작합니다.
                </p>
                <p class="text-muted-foreground">
                    7일간 로그인하면 <span class="text-foreground font-medium">앙님💛</span>으로
                    승급됩니다.
                </p>
                <p class="text-muted-foreground">
                    글쓰기와 댓글 작성은 <span class="text-foreground font-medium">앙님💛</span>부터
                    이용하실 수 있습니다.
                </p>
                <p class="text-muted-foreground mt-2">
                    승급 조건은 <span class="text-foreground font-medium">본인확인</span>과
                    <span class="text-foreground font-medium">로그인 7일</span>이며, 조건을 채우면
                    자동으로 올라갑니다. 따로 신청하지 않으셔도 됩니다.
                </p>
            </div>

            <Button href="https://ads.damoang.net/promotion" class="w-full gap-2">
                <Megaphone class="h-4 w-4" />
                프로모션 관리로 이동
            </Button>
            <Button href="https://damoang.net" variant="outline" class="w-full gap-2">
                <Home class="h-4 w-4" />
                다모앙 홈으로
            </Button>
        </CardContent>
    </Card>
</div>
