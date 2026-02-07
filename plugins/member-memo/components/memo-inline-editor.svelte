<script lang="ts">
    import { getMemo, updateCache, loadMemo } from '../lib/memo-store.svelte';
    import { saveMemo, deleteMemo } from '../lib/memo-api';

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

    interface Props {
        memberId: string;
        onClose: () => void;
    }

    let { memberId, onClose }: Props = $props();

    let content = $state('');
    let memoDetail = $state('');
    let selectedColor = $state<string>('yellow');
    let isSaving = $state(false);
    let isDeleting = $state(false);
    let errorMsg = $state('');
    let showDetail = $state(false);

    let existingMemo = $derived(getMemo(memberId));

    // 초기 데이터 로드
    $effect(() => {
        if (getMemo(memberId) === undefined) {
            void loadMemo(memberId);
        }
    });

    // 메모 데이터로 폼 초기화
    $effect(() => {
        const memo = getMemo(memberId);
        if (memo) {
            content = memo.content ?? '';
            memoDetail = memo.memo_detail ?? '';
            selectedColor = memo.color ?? 'yellow';
            if (memo.memo_detail) showDetail = true;
        }
    });

    async function handleSave() {
        if (!content.trim()) return;
        isSaving = true;
        errorMsg = '';
        try {
            const result = await saveMemo(memberId, {
                content: content.trim(),
                memo_detail: memoDetail.trim(),
                color: selectedColor
            });
            updateCache(memberId, result);
            onClose();
        } catch (err) {
            errorMsg = err instanceof Error ? err.message : '저장 실패';
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!confirm('메모를 삭제하시겠습니까?')) return;
        isDeleting = true;
        errorMsg = '';
        try {
            await deleteMemo(memberId);
            updateCache(memberId, null);
            onClose();
        } catch (err) {
            errorMsg = err instanceof Error ? err.message : '삭제 실패';
        } finally {
            isDeleting = false;
        }
    }
</script>

<div class="memo-inline" onclick={(e) => e.stopPropagation()}>
    <!-- 색상 선택 -->
    <div class="memo-colors">
        {#each COLORS as color (color)}
            <button
                type="button"
                class="memo-color-btn"
                style="background-color: {COLOR_STYLES[color].bg}; color: {COLOR_STYLES[color]
                    .text}; border-color: {selectedColor === color
                    ? COLOR_STYLES[color].text
                    : 'transparent'};"
                onclick={() => (selectedColor = color)}
                disabled={isSaving || isDeleting}
            >
                {COLOR_LABELS[color]}
            </button>
        {/each}
    </div>

    <!-- 메모 입력 -->
    <div class="memo-input-row">
        <input
            type="text"
            bind:value={content}
            maxlength={250}
            placeholder="메모 입력 ({content.length}/250)"
            class="memo-input"
            disabled={isSaving || isDeleting}
        />
    </div>

    <!-- 상세 메모 토글 -->
    {#if showDetail || existingMemo?.memo_detail}
        <textarea
            bind:value={memoDetail}
            rows={2}
            placeholder="상세 메모 (선택)"
            class="memo-textarea"
            disabled={isSaving || isDeleting}
        ></textarea>
    {:else}
        <button type="button" class="memo-detail-toggle" onclick={() => (showDetail = true)}>
            + 상세 메모
        </button>
    {/if}

    <!-- 에러 -->
    {#if errorMsg}
        <p class="memo-error">{errorMsg}</p>
    {/if}

    <!-- 버튼 -->
    <div class="memo-actions">
        {#if existingMemo?.content}
            <button
                type="button"
                class="memo-btn memo-btn--delete"
                onclick={handleDelete}
                disabled={isSaving || isDeleting}
            >
                {isDeleting ? '삭제중' : '삭제'}
            </button>
        {/if}
        <div class="memo-actions-right">
            <button
                type="button"
                class="memo-btn memo-btn--cancel"
                onclick={onClose}
                disabled={isSaving || isDeleting}
            >
                취소
            </button>
            <button
                type="button"
                class="memo-btn memo-btn--save"
                onclick={handleSave}
                disabled={!content.trim() || isSaving || isDeleting}
            >
                {isSaving ? '저장중' : '저장'}
            </button>
        </div>
    </div>
</div>

<style>
    .memo-inline {
        padding: 0.5rem 0;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        animation: memo-slide-down 0.15s ease-out;
    }

    .memo-colors {
        display: flex;
        gap: 0.25rem;
    }

    .memo-color-btn {
        padding: 0.125rem 0.5rem;
        border: 2px solid transparent;
        border-radius: 9999px;
        font-size: 0.6875rem;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s;
    }

    .memo-color-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .memo-input {
        width: 100%;
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        background-color: var(--background);
        color: var(--foreground);
        font-size: 0.8125rem;
        outline: none;
    }

    .memo-input:focus {
        border-color: var(--ring);
        box-shadow: 0 0 0 1px var(--ring);
    }

    .memo-textarea {
        width: 100%;
        padding: 0.375rem 0.5rem;
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        background-color: var(--background);
        color: var(--foreground);
        font-size: 0.8125rem;
        resize: vertical;
        outline: none;
    }

    .memo-textarea:focus {
        border-color: var(--ring);
        box-shadow: 0 0 0 1px var(--ring);
    }

    .memo-detail-toggle {
        padding: 0;
        border: none;
        background: none;
        color: var(--muted-foreground);
        font-size: 0.75rem;
        cursor: pointer;
        text-align: left;
    }

    .memo-detail-toggle:hover {
        color: var(--foreground);
    }

    .memo-error {
        color: var(--destructive);
        font-size: 0.75rem;
        margin: 0;
    }

    .memo-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.375rem;
    }

    .memo-actions-right {
        display: flex;
        gap: 0.25rem;
        margin-left: auto;
    }

    .memo-btn {
        padding: 0.25rem 0.625rem;
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
    }

    .memo-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .memo-btn--save {
        background-color: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
    }

    .memo-btn--save:hover:not(:disabled) {
        opacity: 0.9;
    }

    .memo-btn--cancel {
        background-color: var(--background);
        color: var(--foreground);
    }

    .memo-btn--cancel:hover:not(:disabled) {
        background-color: var(--muted);
    }

    .memo-btn--delete {
        background-color: var(--destructive);
        color: white;
        border-color: var(--destructive);
    }

    .memo-btn--delete:hover:not(:disabled) {
        opacity: 0.9;
    }

    @keyframes memo-slide-down {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
