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
            {#if data.fromWrite && !data.isCertified}
                <div
                    class="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 dark:border-blue-800 dark:bg-blue-950"
                >
                    <p class="font-semibold text-blue-900 dark:text-blue-100">
                        {#if data.blockedBoardName}
                            「{data.blockedBoardName}」에 글을 쓰시려면 본인확인이 필요합니다
                        {:else}
                            글을 쓰시려면 본인확인이 필요합니다
                        {/if}
                    </p>
                    <p class="mt-1 text-blue-800 dark:text-blue-200">
                        등급이나 가입 기간 때문이 아닙니다. 아래에서 본인확인을 마치시면 바로
                        작성하실 수 있습니다.
                    </p>
                </div>
            {/if}

            <div class="border-border bg-muted/40 rounded-lg border p-4 text-sm leading-6">
                <p class="font-semibold">등급 안내</p>
                <p class="text-muted-foreground mt-2">
                    가입 후 닉네임 오른쪽은 <span class="text-foreground font-medium">앙님❤️</span
                    >으로 시작합니다.
                </p>
                <p class="text-muted-foreground">
                    7일간 로그인하면 <span class="text-foreground font-medium">앙님💛</span>으로
                    승급됩니다.
                </p>
                <p class="text-muted-foreground">
                    자유게시판을 비롯한 대부분의 게시판은 <span class="text-foreground font-medium"
                        >앙님💛</span
                    >부터 글쓰기와 댓글 작성을 이용하실 수 있습니다.
                </p>
                <p class="text-muted-foreground mt-2">
                    승급 조건은 <span class="text-foreground font-medium">본인확인</span>과
                    <span class="text-foreground font-medium">로그인 7일</span>이며, 조건을 채우면
                    자동으로 올라갑니다. 따로 신청하지 않으셔도 됩니다.
                </p>

                {#if data.promoteDaysLeft !== null}
                    <div class="border-border/60 mt-3 rounded-md border border-dashed px-3 py-2">
                        {#if data.promoteDaysLeft > 0}
                            <p class="text-foreground font-medium">
                                앙님💛까지 <span class="text-primary"
                                    >로그인 {data.promoteDaysLeft}일</span
                                > 남았습니다.
                            </p>
                            <p class="text-muted-foreground mt-0.5 text-xs">
                                하루에 한 번만 들러 주시면 됩니다.
                            </p>
                        {:else}
                            <p class="text-foreground font-medium">
                                로그인 일수는 이미 채우셨습니다.
                            </p>
                            <p class="text-muted-foreground mt-0.5 text-xs">
                                {#if data.isCertified}
                                    곧 자동으로 승급됩니다.
                                {:else}
                                    본인확인만 마치시면 곧 승급됩니다.
                                {/if}
                            </p>
                        {/if}
                    </div>
                {/if}

                <p class="text-foreground mt-3 font-medium">
                    기다리시는 동안 <a href="/hello" class="underline underline-offset-4"
                        >가입인사</a
                    >를 남겨보세요. <span class="font-semibold">앙님❤️</span>도 바로 쓰실 수 있는
                    게시판입니다.
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
                <Button class="w-full" onclick={() => (window.location.href = '/register/welcome')}>
                    다음으로
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
