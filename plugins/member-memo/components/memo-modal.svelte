<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import {
        getModalTarget,
        closeModal,
        getMemo,
        updateCache,
        loadMemo
    } from '../lib/memo-store.svelte';
    import { saveMemo, deleteMemo } from '../lib/memo-api';
    import X from '@lucide/svelte/icons/x';

    const COLORS = ['yellow', 'green', 'purple', 'red', 'blue'] as const;
    const COLOR_LABELS: Record<string, string> = {
        yellow: '노랑',
        green: '초록',
        purple: '보라',
        red: '빨강',
        blue: '파랑'
    };
    const COLOR_STYLES: Record<string, { bg: string; text: string }> = {
        yellow: { bg: '#ffe69c', text: '#664d03' },
        green: { bg: '#d1e7dd', text: '#0f5132' },
        purple: { bg: '#e2d9f3', text: '#432874' },
        red: { bg: '#f8d7da', text: '#dc3545' },
        blue: { bg: '#cfe2ff', text: '#084298' }
    };

    let content = $state('');
    let memoDetail = $state('');
    let selectedColor = $state<string>('yellow');
    let isSaving = $state(false);
    let isDeleting = $state(false);
    let errorMsg = $state('');
    let dialogEl = $state<HTMLDialogElement | null>(null);

    let modalTarget = $derived(getModalTarget());
    let isOpen = $derived(modalTarget !== null);
    let existingMemo = $derived(modalTarget ? getMemo(modalTarget) : undefined);

    // 모달 열릴 때 기존 메모 데이터로 폼 초기화
    $effect(() => {
        if (modalTarget) {
            if (getMemo(modalTarget) === undefined) {
                void loadMemo(modalTarget);
            }
            const memo = getMemo(modalTarget);
            content = memo?.content ?? '';
            memoDetail = memo?.memo_detail ?? '';
            selectedColor = memo?.color ?? 'yellow';
            errorMsg = '';
        }
    });

    // existingMemo 변경 시 폼 업데이트 (로드 완료 후)
    $effect(() => {
        if (existingMemo) {
            content = existingMemo.content ?? '';
            memoDetail = existingMemo.memo_detail ?? '';
            selectedColor = existingMemo.color ?? 'yellow';
        }
    });

    // <dialog> showModal/close 제어
    $effect(() => {
        if (!dialogEl) return;
        if (isOpen && !dialogEl.open) {
            dialogEl.showModal();
        } else if (!isOpen && dialogEl.open) {
            dialogEl.close();
        }
    });

    // <dialog>의 네이티브 cancel 이벤트 (ESC 키) 처리
    function handleCancel(e: Event) {
        e.preventDefault();
        closeModal();
    }

    // 백드롭 클릭으로 닫기 (dialog 요소 자체를 클릭한 경우)
    function handleDialogClick(e: MouseEvent) {
        if (e.target === dialogEl) {
            closeModal();
        }
    }

    async function handleSave() {
        if (!modalTarget || !content.trim()) return;

        isSaving = true;
        errorMsg = '';
        try {
            const result = await saveMemo(modalTarget, {
                content: content.trim(),
                memo_detail: memoDetail.trim(),
                color: selectedColor
            });
            updateCache(modalTarget, result);
            closeModal();
        } catch (err) {
            errorMsg = err instanceof Error ? err.message : '저장에 실패했습니다.';
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!modalTarget) return;
        if (!confirm('메모를 삭제하시겠습니까?')) return;

        isDeleting = true;
        errorMsg = '';
        try {
            await deleteMemo(modalTarget);
            updateCache(modalTarget, null);
            closeModal();
        } catch (err) {
            errorMsg = err instanceof Error ? err.message : '삭제에 실패했습니다.';
        } finally {
            isDeleting = false;
        }
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<dialog
    bind:this={dialogEl}
    class="memo-dialog"
    oncancel={handleCancel}
    onclick={handleDialogClick}
>
    <div class="memo-panel" onclick={(e) => e.stopPropagation()}>
        <!-- 헤더 -->
        <div class="memo-header">
            <div>
                <h3 class="text-foreground text-lg font-semibold">회원 메모</h3>
                <p class="text-muted-foreground text-sm">
                    이 회원에 대한 개인 메모를 작성합니다. 본인만 볼 수 있습니다.
                </p>
            </div>
            <button type="button" class="memo-close" onclick={() => closeModal()}>
                <X class="h-4 w-4" />
                <span class="sr-only">닫기</span>
            </button>
        </div>

        <!-- 본문 -->
        <div class="space-y-4 py-4">
            <!-- 색상 선택 -->
            <div>
                <p class="text-foreground mb-2 text-sm font-medium">배지 색상</p>
                <div class="flex gap-2">
                    {#each COLORS as color (color)}
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border-2 px-2.5 text-xs font-medium transition-all"
                            style="background-color: {COLOR_STYLES[color].bg}; color: {COLOR_STYLES[
                                color
                            ].text}; border-color: {selectedColor === color
                                ? COLOR_STYLES[color].text
                                : 'transparent'};"
                            onclick={() => (selectedColor = color)}
                        >
                            {COLOR_LABELS[color]}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- 메모 입력 -->
            <div>
                <label for="memo-content" class="text-foreground mb-1 block text-sm font-medium">
                    메모 <span class="text-muted-foreground text-xs"
                        >({content.length}/250)</span
                    >
                </label>
                <input
                    id="memo-content"
                    type="text"
                    bind:value={content}
                    maxlength={250}
                    placeholder="배지에 표시될 짧은 메모"
                    class="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    disabled={isSaving || isDeleting}
                />
            </div>

            <!-- 상세 메모 -->
            <div>
                <label for="memo-detail" class="text-foreground mb-1 block text-sm font-medium">
                    상세 메모 <span class="text-muted-foreground text-xs">(선택)</span>
                </label>
                <Textarea
                    id="memo-detail"
                    bind:value={memoDetail}
                    rows={3}
                    placeholder="자세한 메모 내용 (선택사항)"
                    disabled={isSaving || isDeleting}
                />
            </div>

            <!-- 에러 메시지 -->
            {#if errorMsg}
                <p class="text-destructive text-sm">{errorMsg}</p>
            {/if}
        </div>

        <!-- 푸터 -->
        <div class="flex items-center justify-between border-t pt-4">
            <div>
                {#if existingMemo?.content}
                    <Button
                        variant="destructive"
                        size="sm"
                        onclick={handleDelete}
                        disabled={isSaving || isDeleting}
                    >
                        {isDeleting ? '삭제 중...' : '삭제'}
                    </Button>
                {/if}
            </div>
            <div class="flex gap-2">
                <Button
                    variant="outline"
                    onclick={() => closeModal()}
                    disabled={isSaving || isDeleting}
                >
                    취소
                </Button>
                <Button
                    onclick={handleSave}
                    disabled={!content.trim() || isSaving || isDeleting}
                >
                    {isSaving ? '저장 중...' : '저장'}
                </Button>
            </div>
        </div>
    </div>
</dialog>

<style>
    .memo-dialog {
        border: none;
        border-radius: 0.75rem;
        padding: 0;
        max-width: 28rem;
        width: calc(100% - 2rem);
        background-color: var(--background);
        color: var(--foreground);
        box-shadow:
            0 20px 25px -5px rgba(0, 0, 0, 0.1),
            0 8px 10px -6px rgba(0, 0, 0, 0.1);
        animation: memo-scale-in 0.15s ease-out;
    }

    .memo-dialog::backdrop {
        background-color: rgba(0, 0, 0, 0.4);
        animation: memo-fade-in 0.15s ease-out;
    }

    .memo-panel {
        padding: 1.5rem;
    }

    .memo-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        padding-bottom: 0.5rem;
    }

    .memo-close {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        border: none;
        background: none;
        border-radius: 0.25rem;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.15s;
        flex-shrink: 0;
        color: var(--foreground);
    }

    .memo-close:hover {
        opacity: 1;
    }

    @keyframes memo-fade-in {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }

    @keyframes memo-scale-in {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }
</style>
