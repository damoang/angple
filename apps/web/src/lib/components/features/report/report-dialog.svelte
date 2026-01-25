<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogDescription,
        DialogFooter
    } from '$lib/components/ui/dialog/index.js';
    import { apiClient } from '$lib/api/index.js';
    import type { ReportTargetType, ReportReason, ReportReasonInfo } from '$lib/api/types.js';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import CheckCircle from '@lucide/svelte/icons/check-circle';

    interface Props {
        open?: boolean;
        targetType: ReportTargetType;
        targetId: number | string;
        boardId: string;
        postId: number;
        onClose?: () => void;
        onSuccess?: () => void;
    }

    let {
        open = $bindable(false),
        targetType,
        targetId,
        boardId,
        postId,
        onClose,
        onSuccess
    }: Props = $props();

    // 신고 사유 목록 (ang-gnu nariya 플러그인과 동일한 순서)
    const reportReasons: ReportReasonInfo[] = [
        { value: 1, label: '회원비하' },
        { value: 2, label: '예의없음' },
        { value: 3, label: '부적절한 표현' },
        { value: 4, label: '차별행위' },
        { value: 5, label: '분란유도' },
        { value: 6, label: '여론조성' },
        { value: 7, label: '회원기만' },
        { value: 8, label: '이용방해' },
        { value: 9, label: '용도위반' },
        { value: 10, label: '거래금지위반' },
        { value: 11, label: '구걸' },
        { value: 12, label: '권리침해' },
        { value: 13, label: '외설' },
        { value: 14, label: '위법행위' },
        { value: 15, label: '광고홍보' }
    ];

    // 상태
    let selectedReason = $state<ReportReason | null>(null);
    let isSubmitting = $state(false);
    let isSuccess = $state(false);
    let error = $state<string | null>(null);

    // 제출 가능 여부
    const canSubmit = $derived(selectedReason !== null);

    // 타이틀
    const dialogTitle = $derived(targetType === 'post' ? '게시글 신고' : '댓글 신고');

    // 신고 제출
    async function handleSubmit(): Promise<void> {
        if (!selectedReason) return;

        isSubmitting = true;
        error = null;

        try {
            const request = {
                target_type: targetType,
                target_id: targetId,
                reason: selectedReason
            };

            if (targetType === 'post') {
                await apiClient.reportPost(boardId, postId, request);
            } else {
                await apiClient.reportComment(boardId, postId, targetId, request);
            }

            isSuccess = true;
            onSuccess?.();

            // 2초 후 다이얼로그 닫기
            setTimeout(() => {
                handleClose();
            }, 2000);
        } catch (err) {
            error = err instanceof Error ? err.message : '신고 접수에 실패했습니다.';
        } finally {
            isSubmitting = false;
        }
    }

    // 다이얼로그 닫기
    function handleClose(): void {
        open = false;
        // 상태 초기화
        selectedReason = null;
        isSuccess = false;
        error = null;
        onClose?.();
    }

    // 사유 선택
    function selectReason(reason: ReportReason): void {
        selectedReason = reason;
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
    <DialogContent class="sm:max-w-md">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                <AlertTriangle class="h-5 w-5 text-destructive" />
                {dialogTitle}
            </DialogTitle>
            <DialogDescription>
                부적절한 콘텐츠를 신고해 주시면 검토 후 조치하겠습니다.
            </DialogDescription>
        </DialogHeader>

        {#if isSuccess}
            <!-- 신고 완료 상태 -->
            <div class="flex flex-col items-center justify-center py-8">
                <CheckCircle class="mb-4 h-12 w-12 text-green-500" />
                <p class="text-foreground text-lg font-medium">신고가 접수되었습니다</p>
                <p class="text-muted-foreground mt-2 text-sm">
                    신고 내용을 검토 후 조치하겠습니다.
                </p>
            </div>
        {:else}
            <!-- 신고 사유 선택 -->
            <div class="space-y-4 py-4">
                <div class="space-y-2">
                    <Label>신고 사유를 선택해주세요</Label>
                    <div class="grid gap-2">
                        {#each reportReasons as reason (reason.value)}
                            <button
                                type="button"
                                onclick={() => selectReason(reason.value)}
                                class="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors {selectedReason ===
                                reason.value
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:bg-muted/50'}"
                            >
                                <div
                                    class="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 {selectedReason ===
                                    reason.value
                                        ? 'border-primary bg-primary'
                                        : 'border-muted-foreground'}"
                                >
                                    {#if selectedReason === reason.value}
                                        <div class="flex h-full w-full items-center justify-center">
                                            <div class="h-1.5 w-1.5 rounded-full bg-white"></div>
                                        </div>
                                    {/if}
                                </div>
                                <p class="text-foreground font-medium">{reason.label}</p>
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- 에러 메시지 -->
                {#if error}
                    <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                        {error}
                    </div>
                {/if}
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onclick={handleClose} disabled={isSubmitting}>
                    취소
                </Button>
                <Button
                    type="button"
                    variant="destructive"
                    onclick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                >
                    {#if isSubmitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        신고 중...
                    {:else}
                        신고하기
                    {/if}
                </Button>
            </DialogFooter>
        {/if}
    </DialogContent>
</Dialog>
