<script lang="ts">
    import { page } from '$app/state';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CircleCheck from '@lucide/svelte/icons/circle-check';

    const deadline = $derived(page.url.searchParams.get('deadline') || '');
</script>

<svelte:head>
    <title>탈퇴 신청 완료 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-8">
    <Card>
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <CircleCheck class="h-5 w-5 text-emerald-600" />
                탈퇴가 신청되었습니다
            </CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
            <p class="text-muted-foreground text-sm leading-relaxed">
                {#if deadline}
                    <strong class="text-foreground">{deadline}</strong>까지 다시 로그인하시면 탈퇴를
                    취소할 수 있습니다.
                {:else}
                    신청일로부터 30일 이내에 다시 로그인하시면 탈퇴를 취소할 수 있습니다.
                {/if}
            </p>
            <p class="text-muted-foreground text-xs leading-relaxed">
                30일이 지나면 탈퇴가 확정되며 회원정보는 익명 처리됩니다. 그동안 이용해 주셔서
                감사합니다.
            </p>
            <div class="flex justify-end">
                <Button href="/">홈으로</Button>
            </div>
        </CardContent>
    </Card>
</div>
