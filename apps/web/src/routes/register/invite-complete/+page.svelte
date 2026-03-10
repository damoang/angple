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
            <div class="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CircleCheck class="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle class="text-xl">가입이 완료되었습니다</CardTitle>
            <CardDescription>
                광고주 계정이 생성되었습니다.<br />
                프로모션 관리에서 광고를 설정하세요.
            </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-3">
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
