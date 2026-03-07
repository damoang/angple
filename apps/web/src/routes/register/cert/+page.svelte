<script lang="ts">
    import { goto } from '$app/navigation';
    import { onMount, onDestroy } from 'svelte';
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import Check from '@lucide/svelte/icons/check';
    import CircleAlert from '@lucide/svelte/icons/circle-alert';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    let certCompleted = $state(data.alreadyCertified || !!data.certData?.certNo);
    let certName = $state(data.certData?.name || '');

    function openCertPopup() {
        const width = 500;
        const height = 620;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        window.open(
            '/cert/inicis?pageType=register',
            'sa_popup',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );
    }

    function handleCertMessage(event: MessageEvent) {
        if (event.data?.type === 'cert_result' && event.data.data?.success) {
            certCompleted = true;
            certName = event.data.data.name || '';
        }
    }

    onMount(() => {
        window.addEventListener('message', handleCertMessage);
    });

    onDestroy(() => {
        if (typeof window !== 'undefined') {
            window.removeEventListener('message', handleCertMessage);
        }
    });
</script>

<svelte:head>
    <title>본인인증 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">회원가입 완료</CardTitle>
            <CardDescription>본인인증을 진행해주세요</CardDescription>
        </CardHeader>

        <CardContent>
            {#if certCompleted}
                <!-- 인증 완료 -->
                <div class="space-y-6">
                    <div
                        class="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950"
                    >
                        <div
                            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
                        >
                            <ShieldCheck class="h-5 w-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <p class="font-medium text-green-800 dark:text-green-200">
                                본인인증 완료
                            </p>
                            <p class="text-sm text-green-600 dark:text-green-400">
                                모든 기능을 이용할 수 있습니다.
                                {#if certName}
                                    ({certName})
                                {/if}
                            </p>
                        </div>
                    </div>

                    <Button class="w-full" onclick={() => goto('/')}>
                        <Check class="mr-2 h-4 w-4" />
                        시작하기
                    </Button>
                </div>
            {:else}
                <!-- 인증 전 -->
                <div class="space-y-6">
                    <div
                        class="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950"
                    >
                        <div
                            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900"
                        >
                            <CircleAlert class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <p class="font-medium text-yellow-800 dark:text-yellow-200">
                                본인인증이 필요합니다
                            </p>
                            <p class="text-sm text-yellow-600 dark:text-yellow-400">
                                인증하지 않으면 글쓰기, 댓글, 추천, 신고 기능이 제한됩니다.
                            </p>
                        </div>
                    </div>

                    <Button class="w-full" onclick={openCertPopup}>
                        <ShieldCheck class="mr-2 h-4 w-4" />
                        간편인증 하기
                    </Button>

                    <Button variant="ghost" class="w-full" onclick={() => goto('/')}>
                        나중에 하기
                    </Button>
                </div>
            {/if}
        </CardContent>
    </Card>
</div>
