<script lang="ts">
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import ShieldAlert from '@lucide/svelte/icons/shield-alert';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    function openCertPopup() {
        const width = 500;
        const height = 600;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        window.open(
            '/cert/inicis?pageType=register',
            'cert_popup',
            `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );
    }

    // 팝업에서 인증 완료 시 메시지 수신 (postMessage + localStorage 이벤트)
    function handleMessage(e: MessageEvent) {
        if (e.data?.type === 'cert_complete' && e.data?.success) {
            location.reload();
        }
    }

    function handleStorage(e: StorageEvent) {
        if (e.key === 'cert_result') {
            try {
                const result = JSON.parse(e.newValue || '');
                if (result.success) {
                    localStorage.removeItem('cert_result');
                    location.reload();
                }
            } catch {
                // ignore
            }
        }
    }

    // localStorage 폴링 (storage 이벤트가 동작하지 않는 경우 대비)
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    function startPolling() {
        pollTimer = setInterval(() => {
            try {
                const raw = localStorage.getItem('cert_result');
                if (raw) {
                    const result = JSON.parse(raw);
                    if (result.success) {
                        localStorage.removeItem('cert_result');
                        clearInterval(pollTimer);
                        location.reload();
                    }
                }
            } catch {}
        }, 1000);
    }

    $effect(() => {
        window.addEventListener('message', handleMessage);
        window.addEventListener('storage', handleStorage);
        startPolling();
        return () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('storage', handleStorage);
            if (pollTimer) clearInterval(pollTimer);
        };
    });
</script>

<svelte:head>
    <title>실명인증 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
    <Card class="w-full max-w-md">
        <CardHeader class="text-center">
            <CardTitle class="text-2xl font-bold">실명인증</CardTitle>
            <CardDescription>
                {#if data.isCertified}
                    본인확인이 완료되었습니다
                {:else}
                    서비스 이용을 위해 본인확인이 필요합니다
                {/if}
            </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
            <div class="border-border bg-muted/40 rounded-lg border p-4 text-sm leading-6">
                <p class="font-semibold">등급 안내</p>
                <p class="text-muted-foreground mt-2">
                    가입 후 닉네임 오른쪽은 <span class="font-medium text-foreground">앙님❤️</span
                    >으로 시작합니다.
                </p>
                <p class="text-muted-foreground">
                    7일간 로그인하면 <span class="font-medium text-foreground">앙님💛</span>으로
                    승급됩니다.
                </p>
                <p class="text-muted-foreground">
                    글쓰기와 댓글 작성은 <span class="font-medium text-foreground">앙님💛</span
                    >부터 이용하실 수 있습니다.
                </p>
                <p class="text-muted-foreground mt-2">
                    현재 시스템 안정화로 인해 자동 승급은 일시 중단되었으며, 매주 일요일 수동으로
                    등급을 상향 조정해드리고 있습니다.
                </p>
            </div>

            {#if data.isCertified}
                <!-- 인증 완료 상태 -->
                <div
                    class="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950"
                >
                    <ShieldCheck class="h-6 w-6 shrink-0 text-green-600 dark:text-green-400" />
                    <div>
                        <p class="font-medium text-green-800 dark:text-green-200">인증 완료</p>
                        <p class="text-sm text-green-600 dark:text-green-400">
                            본인확인이 정상적으로 완료되었습니다.
                        </p>
                    </div>
                </div>
                <Button class="w-full" onclick={() => (window.location.href = '/')}>
                    메인으로 이동
                </Button>
            {:else}
                <!-- 인증 필요 상태 -->
                <div
                    class="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950"
                >
                    <ShieldAlert class="h-6 w-6 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <div>
                        <p class="font-medium text-yellow-800 dark:text-yellow-200">인증 필요</p>
                        <p class="text-sm text-yellow-600 dark:text-yellow-400">
                            {#if data.certRequired}
                                본인확인을 완료해야 서비스를 이용할 수 있습니다.
                            {:else}
                                일부 게시판 이용 시 본인확인이 필요할 수 있습니다.
                            {/if}
                        </p>
                    </div>
                </div>

                <div class="space-y-3">
                    <Button class="w-full" onclick={openCertPopup}>
                        <ShieldCheck class="mr-2 h-4 w-4" />
                        간편인증 하기
                    </Button>

                    <a
                        href="https://damoang.net/verification/45"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 text-sm underline-offset-4 hover:underline"
                    >
                        해외 거주자 실명인증 안내
                        <ExternalLink class="h-3 w-3" />
                    </a>
                </div>

                {#if !data.certRequired}
                    <div class="border-border border-t pt-4">
                        <Button
                            variant="ghost"
                            class="text-muted-foreground w-full"
                            onclick={() => (window.location.href = '/')}
                        >
                            나중에 하기
                        </Button>
                    </div>
                {/if}
            {/if}
        </CardContent>
    </Card>
</div>
