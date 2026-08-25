<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CircleCheck from '@lucide/svelte/icons/circle-check';

    // 2026-08-25 숙려기간 폐지 — 취소 기한(deadline)이 없어져 표시할 것이 없다.
</script>

<svelte:head>
    <title>탈퇴 완료 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-8">
    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <CircleCheck class="h-5 w-5 text-emerald-600" />
                탈퇴가 완료되었습니다
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
            <p class="text-muted-foreground text-sm leading-relaxed">
                계정이 비활성화되었습니다. 그동안 이용해 주셔서 감사합니다.
            </p>
            <div class="flex justify-end">
                <Button href="/">홈으로</Button>
            </div>
        </CardContent>
    </Card>
</div>
