<script lang="ts">
    import { getMemo, openModal, loadMemo } from '../lib/memo-store.svelte';
    import { authStore } from '$lib/stores/auth.svelte';

    interface Props {
        memberId: string;
        /** true = 메모 없어도 아이콘 표시 (게시글 상세), false = 메모 있을 때만 배지 (목록) */
        showIcon?: boolean;
        /** 커스텀 클릭 핸들러 (제공 시 openModal 대신 사용) */
        onclick?: () => void;
    }

    let { memberId, showIcon = false, onclick }: Props = $props();

    function handleClick() {
        if (onclick) onclick();
        else openModal(memberId);
    }
    let memo = $derived(getMemo(memberId));

    // 본인이면 표시 안 함
    let isSelf = $derived(authStore.user?.mb_id === memberId);

    // 캐시에 없으면 로드 트리거
    $effect(() => {
        if (authStore.isAuthenticated && memberId && !isSelf && memo === undefined) {
            void loadMemo(memberId);
        }
    });
</script>

{#if authStore.isAuthenticated && !isSelf}
    {#if memo?.content}
        <!-- 메모 있음: 아이콘(선택) + 색상 배지 -->
        <span class="memo-wrap">
            {#if showIcon}
                <button
                    type="button"
                    class="memo-icon"
                    onclick={handleClick}
                    title="메모 편집"
                >
                    <svg class="memo-svg" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M5 0h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2 2 2 0 0 1-2 2H3a2 2 0 0 1-2-2h1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1H1a2 2 0 0 1 2-2h2V0z"/>
                        <path d="M1 6v-.5a.5.5 0 0 1 1 0V6h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0V9h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1z"/>
                    </svg>
                </button>
            {/if}
            <button
                type="button"
                class="memo-badge memo-color--{memo.color || 'yellow'}"
                onclick={handleClick}
                title={memo.content}
            >
                {memo.content.length > 6 ? memo.content.slice(0, 6) + '\u2026' : memo.content}
            </button>
        </span>
    {:else if showIcon}
        <!-- 메모 없음 + showIcon: 아이콘만 표시 (클릭하여 새 메모 작성) -->
        <button
            type="button"
            class="memo-icon memo-icon--empty"
            onclick={handleClick}
            title="메모 작성"
        >
            <svg class="memo-svg" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 0h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2 2 2 0 0 1-2 2H3a2 2 0 0 1-2-2h1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1H1a2 2 0 0 1 2-2h2V0z"/>
                <path d="M1 6v-.5a.5.5 0 0 1 1 0V6h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0V9h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1H1z"/>
            </svg>
        </button>
    {/if}
{/if}

<style>
    .memo-wrap {
        display: inline-flex;
        align-items: center;
        gap: 0.125rem;
        vertical-align: middle;
    }

    .memo-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--color-primary, #6366f1);
        opacity: 0.7;
        transition: opacity 0.15s;
    }

    .memo-icon:hover {
        opacity: 1;
    }

    .memo-icon--empty {
        opacity: 0.35;
    }

    .memo-icon--empty:hover {
        opacity: 0.7;
    }

    .memo-svg {
        width: 0.875rem;
        height: 0.875rem;
    }

    .memo-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.0625rem 0.375rem;
        border-radius: 9999px;
        font-size: 0.6875rem;
        line-height: 1.25rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
        white-space: nowrap;
        vertical-align: middle;
        max-width: 10em;
        overflow: hidden;
        text-overflow: ellipsis;
        transition: opacity 0.15s;
    }

    .memo-badge:hover {
        opacity: 0.8;
    }

    .memo-color--yellow {
        background-color: #ffe69c;
        color: #664d03;
    }

    .memo-color--green {
        background-color: #d1e7dd;
        color: #0f5132;
    }

    .memo-color--purple {
        background-color: #e2d9f3;
        color: #432874;
    }

    .memo-color--red {
        background-color: #f8d7da;
        color: #dc3545;
    }

    .memo-color--blue {
        background-color: #cfe2ff;
        color: #084298;
    }
</style>
