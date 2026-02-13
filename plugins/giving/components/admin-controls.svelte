<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { GivingStatus } from '../types/giving.js';
    import Shield from '@lucide/svelte/icons/shield';
    import Pause from '@lucide/svelte/icons/pause';
    import Play from '@lucide/svelte/icons/play';
    import OctagonX from '@lucide/svelte/icons/octagon-x';

    let {
        postId,
        status = 'active' as GivingStatus,
        authorId = '',
        pausedAt = '',
        onStatusChange
    }: {
        postId: number;
        status?: GivingStatus;
        authorId?: string;
        pausedAt?: string;
        onStatusChange?: (newStatus: GivingStatus) => void;
    } = $props();

    let isProcessing = $state(false);
    let errorMsg = $state('');
    let showForceStopConfirm = $state(false);

    // 관리자(mb_level >= 10) 또는 글 작성자만 표시
    const isVisible = $derived(() => {
        if (!authStore.isAuthenticated) return false;
        const userLevel = authStore.user?.mb_level ?? 1;
        if (userLevel >= 10) return true;
        return authStore.user?.mb_id === authorId;
    });

    const statusLabel = $derived(() => {
        switch (status) {
            case 'active':
                return { text: '진행중', variant: 'default' as const, class: 'bg-green-600' };
            case 'paused':
                return { text: '일시정지', variant: 'default' as const, class: 'bg-yellow-600' };
            case 'ended':
                return { text: '종료', variant: 'secondary' as const, class: '' };
            case 'waiting':
                return { text: '대기중', variant: 'default' as const, class: 'bg-blue-600' };
        }
    });

    async function handlePause() {
        isProcessing = true;
        errorMsg = '';
        try {
            const res = await fetch(`/api/plugins/giving/admin/${postId}/pause`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                onStatusChange?.('paused');
            } else {
                errorMsg = data.error || '일시정지에 실패했습니다.';
            }
        } catch {
            errorMsg = '요청 중 오류가 발생했습니다.';
        } finally {
            isProcessing = false;
        }
    }

    async function handleResume() {
        isProcessing = true;
        errorMsg = '';
        try {
            const res = await fetch(`/api/plugins/giving/admin/${postId}/resume`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                onStatusChange?.('active');
            } else {
                errorMsg = data.error || '재개에 실패했습니다.';
            }
        } catch {
            errorMsg = '요청 중 오류가 발생했습니다.';
        } finally {
            isProcessing = false;
        }
    }

    async function handleForceStop() {
        isProcessing = true;
        errorMsg = '';
        try {
            const res = await fetch(`/api/plugins/giving/admin/${postId}/force-stop`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                showForceStopConfirm = false;
                onStatusChange?.('ended');
            } else {
                errorMsg = data.error || '강제 종료에 실패했습니다.';
            }
        } catch {
            errorMsg = '요청 중 오류가 발생했습니다.';
        } finally {
            isProcessing = false;
        }
    }
</script>

{#if isVisible()}
    <Card class="border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20">
        <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-2 text-base">
                <Shield class="h-4 w-4 text-orange-600 dark:text-orange-400" />
                관리자 컨트롤
            </CardTitle>
        </CardHeader>

        <CardContent class="space-y-3">
            <!-- 현재 상태 -->
            <div class="flex items-center justify-between">
                <span class="text-muted-foreground text-sm">현재 상태</span>
                <Badge variant={statusLabel().variant} class={statusLabel().class}>
                    {statusLabel().text}
                </Badge>
            </div>

            <!-- 일시정지 시간 -->
            {#if pausedAt && status === 'paused'}
                <div class="flex items-center justify-between">
                    <span class="text-muted-foreground text-sm">일시정지 시각</span>
                    <span class="text-sm font-medium">
                        {new Date(pausedAt).toLocaleString('ko-KR')}
                    </span>
                </div>
            {/if}

            {#if errorMsg}
                <p class="text-destructive text-sm">{errorMsg}</p>
            {/if}

            <!-- 액션 버튼 -->
            {#if status !== 'ended'}
                <div class="flex gap-2">
                    {#if status === 'active'}
                        <Button
                            variant="outline"
                            size="sm"
                            class="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
                            onclick={handlePause}
                            disabled={isProcessing}
                        >
                            <Pause class="mr-1.5 h-3.5 w-3.5" />
                            {isProcessing ? '처리중...' : '일시정지'}
                        </Button>
                    {:else if status === 'paused'}
                        <Button
                            variant="outline"
                            size="sm"
                            class="flex-1 border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/30"
                            onclick={handleResume}
                            disabled={isProcessing}
                        >
                            <Play class="mr-1.5 h-3.5 w-3.5" />
                            {isProcessing ? '처리중...' : '재개'}
                        </Button>
                    {/if}

                    {#if !showForceStopConfirm}
                        <Button
                            variant="outline"
                            size="sm"
                            class="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                            onclick={() => (showForceStopConfirm = true)}
                            disabled={isProcessing}
                        >
                            <OctagonX class="mr-1.5 h-3.5 w-3.5" />
                            강제 종료
                        </Button>
                    {/if}
                </div>

                <!-- 강제 종료 확인 -->
                {#if showForceStopConfirm}
                    <div
                        class="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30"
                    >
                        <p class="mb-2 text-sm font-medium text-red-700 dark:text-red-300">
                            정말 나눔을 강제 종료하시겠습니까?
                        </p>
                        <p class="mb-3 text-xs text-red-600 dark:text-red-400">
                            강제 종료 시 즉시 당첨자가 결정되며, 이 작업은 되돌릴 수 없습니다.
                        </p>
                        <div class="flex gap-2">
                            <Button
                                variant="destructive"
                                size="sm"
                                class="flex-1"
                                onclick={handleForceStop}
                                disabled={isProcessing}
                            >
                                {isProcessing ? '처리중...' : '확인, 강제 종료'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                class="flex-1"
                                onclick={() => (showForceStopConfirm = false)}
                                disabled={isProcessing}
                            >
                                취소
                            </Button>
                        </div>
                    </div>
                {/if}
            {/if}
        </CardContent>
    </Card>
{/if}
