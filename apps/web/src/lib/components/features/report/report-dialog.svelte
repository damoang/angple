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
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type {
        ReportTargetType,
        ReportReason,
        ReportReasonInfo,
        CommentReportInfo
    } from '$lib/api/types.js';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import CheckCircle from '@lucide/svelte/icons/check-circle';
    import Users from '@lucide/svelte/icons/users';

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
        { value: 39, label: '뉴스펌글누락' },
        { value: 40, label: '뉴스전문전재' }
    ];

    // 상태
    let selectedReasons = $state<Set<ReportReason>>(new Set());
    let detail = $state('');
    let isSubmitting = $state(false);
    let isSuccess = $state(false);
    let showConfirm = $state(false);
    let error = $state<string | null>(null);

    // 관리자 신고자 목록
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);
    let showReporters = $state(false);
    let reporters = $state<CommentReportInfo[]>([]);
    let isLoadingReporters = $state(false);

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
            error = err instanceof Error ? err.message : '신고 접수에 실패했습니다.';
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
        showReporters = false;
        reporters = [];
        onClose?.();
    }

    // 사유 토글 (다중 선택)
    function toggleReason(reason: ReportReason): void {
        const next = new Set(selectedReasons);
        if (next.has(reason)) next.delete(reason);
        else next.add(reason);
        selectedReasons = next;
    }

    // 관리자: 신고자 목록 로드
    async function loadReporters(): Promise<void> {
        if (showReporters) {
            showReporters = false;
            return;
        }
        isLoadingReporters = true;
        try {
            reporters = await apiClient.getCommentReports(boardId, postId);
            // 해당 대상만 필터
            if (targetType === 'comment') {
                reporters = reporters.filter((r) => String(r.comment_id) === String(targetId));
            }
            showReporters = true;
        } catch {
            reporters = [];
            showReporters = true;
        } finally {
            isLoadingReporters = false;
        }
    }
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
    <DialogContent class="sm:max-w-md">
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
            <div class="space-y-4 py-4">
                <!-- 관리자: 신고자 목록 버튼 (신고 있을 때만) -->
                {#if isAdmin && reportCount > 0}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        class="w-full gap-2"
                        onclick={loadReporters}
                        disabled={isLoadingReporters}
                    >
                        {#if isLoadingReporters}
                            <Loader2 class="h-4 w-4 animate-spin" />
                        {:else}
                            <Users class="h-4 w-4" />
                        {/if}
                        신고자 목록 ({reportCount}건)
                    </Button>

                    {#if showReporters}
                        <div class="bg-muted/50 max-h-40 space-y-1 overflow-y-auto rounded-lg p-3">
                            {#if reporters.length === 0}
                                <p class="text-muted-foreground text-center text-sm">
                                    신고 내역이 없습니다.
                                </p>
                            {:else}
                                {#each reporters as r}
                                    <div class="flex items-center justify-between text-sm">
                                        <span class="text-foreground font-medium"
                                            >{r.reporter_name}</span
                                        >
                                        <span class="text-muted-foreground text-xs">
                                            {r.reason_label} &middot; {new Date(
                                                r.created_at
                                            ).toLocaleDateString('ko-KR')}
                                        </span>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    {/if}
                {/if}

                <div class="space-y-2">
                    <Label
                        >신고 사유를 선택해주세요 <span class="text-muted-foreground font-normal"
                            >(복수 선택 가능)</span
                        ></Label
                    >
                    <div class="grid grid-cols-3 gap-2">
                        {#each reportReasons as reason (reason.value)}
                            <button
                                type="button"
                                onclick={() => toggleReason(reason.value)}
                                class="rounded-lg border px-3 py-2 text-center text-sm transition-colors {selectedReasons.has(
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
                        class="min-h-[80px] resize-none"
                    />
                </div>

                <!-- 에러 메시지 -->
                {#if error}
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
                        disabled={isSubmitting}
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
