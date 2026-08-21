<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogDescription,
        DialogFooter
    } from '$lib/components/ui/dialog/index.js';
    import { apiClient } from '$lib/api/index.js';
    import { ApiRequestError } from '$lib/api/errors.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { ReportTargetType, ReportReason, ReportReasonInfo } from '$lib/api/types.js';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import CheckCircle from '@lucide/svelte/icons/check-circle';
    import Info from '@lucide/svelte/icons/info';

    interface Props {
        open?: boolean;
        targetType: ReportTargetType;
        targetId: number | string;
        boardId: string;
        postId: number;
        reportCount?: number;
        onClose?: () => void;
        onSuccess?: () => void;
    }

    let {
        open = $bindable(false),
        targetType,
        targetId,
        boardId,
        postId,
        reportCount = 0,
        onClose,
        onSuccess
    }: Props = $props();

    // 신고 처리 안내 문구 — 처리 지연 여론에 선제적으로 기대치를 맞추기 위한 안내.
    // 문구는 여기서만 수정하면 반영됨(상수). ⛔신고건수 등 수치는 노출하지 않는다.
    const REPORT_NOTICE =
        '다모앙은 접수된 모든 신고를 신고·모니터링 담당자가 순차적으로 신중하게 검토합니다. 신고량이 많아 처리까지 수일이 소요될 수 있는 점 양해 부탁드립니다. 같은 건은 중복으로 신고하지 않으셔도 됩니다.';

    // 신고 사유 목록 (nariya 플러그인 g5_na_singo sg_type 코드 21~40)
    const reportReasons: ReportReasonInfo[] = [
        { value: 21, label: '회원비하' },
        { value: 22, label: '예의없음' },
        { value: 23, label: '부적절한 표현' },
        { value: 24, label: '차별행위' },
        { value: 25, label: '분란유도/갈등조장' },
        { value: 26, label: '여론조성' },
        { value: 27, label: '회원기만' },
        { value: 28, label: '이용방해' },
        { value: 29, label: '용도위반' },
        { value: 30, label: '거래금지위반' },
        { value: 31, label: '구걸' },
        { value: 32, label: '권리침해' },
        { value: 33, label: '외설' },
        { value: 34, label: '위법행위' },
        { value: 35, label: '광고/홍보' },
        { value: 36, label: '운영정책부정' },
        { value: 37, label: '다중이' },
        { value: 38, label: '기타사유' },
        // 뉴스펌글누락(39)는 일반 신고 사유 선택에서 숨김(운영 전용).
        // 기존 신고 내역의 라벨 표시는 report-reasons.ts 매핑으로 유지됨.
        { value: 40, label: '뉴스전문전재' }
    ];

    // 상태
    let selectedReasons = $state<Set<ReportReason>>(new Set());
    let detail = $state('');
    let isSubmitting = $state(false);
    let isSuccess = $state(false);
    let showConfirm = $state(false);
    let error = $state<string | null>(null);
    // 이미 제재 처리된 게시물(409) — 재시도 불가이므로 제출 버튼 비활성
    let alreadyHandled = $state(false);

    // #12605: 직전 신고 사유 자동복원(#12486) 제거. 신고는 이용제한 근거가 되므로
    // 새 신고는 항상 빈 사유로 시작한다 — 이전 사유가 미리 선택돼 의도치 않은
    // 사유로 접수되는 문제(원치 않는 사유가 자꾸 선택됨)를 방지.

    // 제출 가능 여부
    const canSubmit = $derived(selectedReasons.size > 0);

    // 타이틀
    const dialogTitle = $derived(targetType === 'post' ? '게시글 신고' : '댓글 신고');

    // 신고 확인 단계
    function handleReportClick(): void {
        if (selectedReasons.size === 0) return;
        showConfirm = true;
    }

    // 신고 제출
    async function handleSubmit(): Promise<void> {
        if (selectedReasons.size === 0) return;

        showConfirm = false;
        isSubmitting = true;
        error = null;

        try {
            const request = {
                target_type: targetType,
                target_id: targetId,
                reasons: [...selectedReasons],
                ...(detail.trim() ? { detail: detail.trim() } : {})
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
            if (err instanceof ApiRequestError && err.status === 409) {
                // bug/13487: 신고 누적으로 잠금(대기) 처리된 글 — 중복 신고 불가.
                // 신고한 적 없는 사용자가 "이미 신고 처리가 완료된 게시물입니다" 빨간 오류를 보고
                // 당황하던 문제라, 오류(destructive)가 아니라 중립 안내로 표시한다. 재시도는 차단.
                alreadyHandled = true;
            } else {
                error = err instanceof Error ? err.message : '신고 접수에 실패했습니다.';
            }
        } finally {
            isSubmitting = false;
        }
    }

    // 다이얼로그 닫기
    function handleClose(): void {
        open = false;
        // 상태 초기화
        selectedReasons = new Set();
        detail = '';
        isSuccess = false;
        showConfirm = false;
        error = null;
        alreadyHandled = false;
        onClose?.();
    }

    // 사유 토글 (다중 선택)
    function toggleReason(reason: ReportReason): void {
        const next = new Set(selectedReasons);
        if (next.has(reason)) next.delete(reason);
        else next.add(reason);
        selectedReasons = next;
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
    <DialogContent class="top-[5vh] max-h-[90dvh] translate-y-0 overflow-y-auto sm:max-w-md">
        <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
                <AlertTriangle class="text-destructive h-5 w-5" />
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
            <div class="space-y-3 py-3">
                <!-- 신고 처리 안내 (info 박스) — 수치 미노출, 기대치 안내만 -->
                <div
                    class="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-md border p-3 text-xs leading-relaxed break-keep"
                >
                    <Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p>{REPORT_NOTICE}</p>
                </div>

                <div class="space-y-2">
                    <Label
                        >신고 사유를 선택해주세요 <span class="text-muted-foreground font-normal"
                            >(복수 선택 가능)</span
                        ></Label
                    >
                    <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                        {#each reportReasons as reason (reason.value)}
                            <button
                                type="button"
                                onclick={() => toggleReason(reason.value)}
                                class="rounded-md border px-2 py-1.5 text-center text-xs transition-colors {selectedReasons.has(
                                    reason.value
                                )
                                    ? 'border-primary bg-primary/5 text-primary font-semibold'
                                    : 'border-border text-foreground hover:bg-muted/50'}"
                            >
                                {reason.label}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- 의견 입력란 -->
                <div class="space-y-2">
                    <Label for="report-detail"
                        >의견 <span class="text-muted-foreground font-normal">(선택)</span></Label
                    >
                    <Textarea
                        id="report-detail"
                        bind:value={detail}
                        placeholder="신고 사유에 대한 추가 의견을 남겨주세요"
                        class="min-h-[60px] resize-none"
                    />
                </div>

                <!-- 이미 신고 누적으로 잠금(대기) 처리된 글 안내 (bug/13487, 오류 아님) -->
                {#if alreadyHandled}
                    <div class="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                        이미 여러 신고가 접수되어 검토·잠금 처리 중인 게시물입니다. 추가로 신고하지
                        않으셔도 됩니다.
                    </div>
                {:else if error}
                    <!-- 에러 메시지 -->
                    <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                        {error}
                    </div>
                {/if}

                <!-- 신고 확인 단계 -->
                {#if showConfirm}
                    <div class="bg-destructive/10 rounded-md p-3 text-sm">
                        <p class="text-destructive font-medium">정말 신고하시겠습니까?</p>
                        <p class="text-muted-foreground mt-1">
                            신고가 접수되면 취소할 수 없습니다.
                        </p>
                    </div>
                {/if}
            </div>

            <DialogFooter>
                {#if showConfirm}
                    <Button type="button" variant="outline" onclick={() => (showConfirm = false)}>
                        돌아가기
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onclick={handleSubmit}
                        disabled={isSubmitting || alreadyHandled}
                    >
                        {#if isSubmitting}
                            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                            신고 중...
                        {:else}
                            확인
                        {/if}
                    </Button>
                {:else}
                    <Button
                        type="button"
                        variant="outline"
                        onclick={handleClose}
                        disabled={isSubmitting}
                    >
                        취소
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onclick={handleReportClick}
                        disabled={!canSubmit || isSubmitting}
                    >
                        신고하기
                    </Button>
                {/if}
            </DialogFooter>
        {/if}
    </DialogContent>
</Dialog>
