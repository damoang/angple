<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
</script>

<svelte:head>
    <title>이메일 변경 인증 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-md px-4 py-16">
    <Card>
        <CardHeader class="text-center">
            <CardTitle>이메일 변경 인증</CardTitle>
        </CardHeader>
        <CardContent class="text-center">
            {#if data.success}
                <div class="space-y-4">
                    <CircleCheck class="mx-auto h-12 w-12 text-green-600" />
                    <p class="text-foreground text-lg font-medium">이메일이 변경되었습니다</p>
                    <p class="text-muted-foreground text-sm">
                        새 이메일: <strong>{data.newEmail}</strong>
                    </p>
                    <Button href="/member/settings" variant="outline">설정으로 돌아가기</Button>
                </div>
            {:else}
                <div class="space-y-4">
                    <CircleAlert class="mx-auto h-12 w-12 text-red-600" />
                    <p class="text-foreground text-lg font-medium">인증 실패</p>
                    <p class="text-muted-foreground text-sm">{data.error}</p>
                    <Button href="/member/settings" variant="outline">설정으로 돌아가기</Button>
                </div>
            {/if}
        </CardContent>
    </Card>
</div>
