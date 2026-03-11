<script lang="ts">
    import { onMount } from 'svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import {
        type ReactionItem,
        getReactionDisplay,
        generateDocumentTargetId,
        generateCommentTargetId,
        generateParentId
    } from '$lib/types/reaction.js';
    import {
        REACTION_CATEGORIES,
        REACTION_EMOTICONS,
        REACTION_REPLACE
    } from '$lib/config/reaction-config.js';
    import SmilePlus from '@lucide/svelte/icons/smile-plus';
    import {
        canUseCertifiedAction,
        getCertificationBlockedMessage,
        goToCertification
    } from '$lib/utils/certification-gate.js';

    interface Props {
        boardId: string;
        postId: number | string;
        commentId?: number | string;
        target: 'post' | 'comment';
        initialReactions?: ReactionItem[];
    }

    let { boardId, postId, commentId, target, initialReactions }: Props = $props();

    let reactions = $state<ReactionItem[]>([]);
    let isLoading = $state(false);
    let isReacting = $state(false);
    let showPicker = $state(false);
    let activeCategory = $state('angticon');
    let pickerStyle = $state('');
    let addBtnEl: HTMLButtonElement | undefined = $state();

    // target/parent ID 생성 (da_reaction 호환)
    const targetId = $derived(
        target === 'comment' && commentId
            ? generateCommentTargetId(boardId, commentId)
            : generateDocumentTargetId(boardId, postId)
    );
    const parentId = $derived(generateParentId(boardId, postId));

    // 현재 카테고리의 이모티콘
    const categoryEmoticons = $derived(
        REACTION_EMOTICONS.filter((e) => e.category === activeCategory)
    );

    // 리액션 로드
    async function loadReactions(): Promise<void> {
        isLoading = true;
        try {
            const res = await fetch(`/api/reactions?targetId=${encodeURIComponent(targetId)}`);
            const data = await res.json();
            if (data.status === 'success' && data.result[targetId]) {
                reactions = data.result[targetId];
            } else {
                reactions = [];
            }
        } catch (err) {
            console.error('Failed to load reactions:', err);
        } finally {
            isLoading = false;
        }
    }

    // 리액션 추가/토글
    async function react(reaction: string, mode: string = 'add'): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        if (!canUseCertifiedAction(authStore.user, boardId)) {
            goToCertification();
            return;
        }
        if (isReacting) return;

        isReacting = true;
        showPicker = false;

        // 교체 맵 적용
        const finalReaction = REACTION_REPLACE[reaction] || reaction;

        try {
            const res = await fetch('/api/reactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reaction: finalReaction,
                    targetId,
                    parentId,
                    reactionMode: mode
                })
            });
            const data = await res.json();
            if (data.status === 'success' && data.result[targetId]) {
                reactions = data.result[targetId];
            }
        } catch (err) {
            console.error('Failed to react:', err);
        } finally {
            isReacting = false;
        }
    }

    // 기존 리액션 클릭 (토글)
    function handleReactionClick(reaction: string): void {
        react(reaction, 'toggle');
    }

    // 피커 위치 계산 (fixed positioning으로 overflow-hidden 부모 탈출)
    function updatePickerPosition(): void {
        if (!addBtnEl) return;
        const rect = addBtnEl.getBoundingClientRect();
        const pickerW = 288; // w-72 = 18rem = 288px
        const pickerH = 260;
        let left = rect.left;
        let top = rect.top - pickerH - 8;

        // 화면 밖으로 나가면 조정
        if (left + pickerW > window.innerWidth) {
            left = window.innerWidth - pickerW - 8;
        }
        if (left < 8) left = 8;
        if (top < 8) {
            top = rect.bottom + 8; // 위에 공간 없으면 아래에 표시
        }

        pickerStyle = `position:fixed;left:${left}px;top:${top}px;z-index:9999;`;
    }

    // 피커 외부 클릭
    function handleClickOutside(event: MouseEvent): void {
        const el = event.target as HTMLElement;
        if (!el.closest('.reaction-bar-root') && !el.closest('.reaction-picker-fixed')) {
            queueMicrotask(() => {
                showPicker = false;
            });
        }
    }

    // initialReactions 반응적 감시 (SSR 스트리밍 데이터 도착 시 자동 적용)
    $effect(() => {
        if (initialReactions !== undefined) {
            reactions = initialReactions;
        }
    });

    onMount(() => {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });
</script>

<div class="reaction-bar-root relative inline-flex flex-wrap items-center gap-1.5">
    <!-- 기존 리액션 배지 -->
    {#each reactions as item (item.reaction)}
        {@const display = getReactionDisplay(item.reaction)}
        <button
            type="button"
            onclick={() => handleReactionClick(item.reaction)}
            disabled={isReacting}
            class="da-reaction-badge group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all
				{item.choose
                ? 'border-primary/50 bg-primary/10 text-primary ring-primary/20 ring-1'
                : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5'}"
            title={display.label}
        >
            {#if display.renderType === 'image' && display.url}
                <img
                    src={display.url}
                    alt={display.label}
                    class="h-5 w-5 object-scale-down transition-transform group-hover:scale-[2.5]"
                />
            {:else}
                <span class="text-base leading-none">{display.emoji}</span>
            {/if}
            <span class="font-medium">{item.count}</span>
        </button>
    {/each}

    <!-- 리액션 추가 버튼 -->
    <button
        bind:this={addBtnEl}
        type="button"
        onclick={(e) => {
            e.stopPropagation();
            if (!authStore.isAuthenticated) {
                authStore.redirectToLogin();
                return;
            }
            if (!canUseCertifiedAction(authStore.user, boardId)) {
                goToCertification();
                return;
            }
            showPicker = !showPicker;
            if (showPicker) {
                requestAnimationFrame(() => updatePickerPosition());
            }
        }}
        class="border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground inline-flex h-8 items-center gap-1 rounded-full border px-2 text-sm transition-colors"
        title={!canUseCertifiedAction(authStore.user, boardId)
            ? getCertificationBlockedMessage(boardId)
            : '리액션 추가'}
    >
        <SmilePlus class="h-4 w-4" />
    </button>
</div>

<!-- 이모티콘 피커 (fixed positioning으로 overflow-hidden 부모 탈출) -->
{#if showPicker}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="reaction-picker-fixed bg-popover border-border w-72 overflow-hidden rounded-xl border shadow-xl"
        style={pickerStyle}
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                showPicker = false;
            }
        }}
        role="dialog"
        tabindex="-1"
    >
        <!-- 카테고리 탭 -->
        <div class="border-border flex border-b">
            {#each REACTION_CATEGORIES as cat (cat.category)}
                <button
                    type="button"
                    onclick={() => (activeCategory = cat.category)}
                    class="flex-1 px-2 py-1.5 text-xs font-medium transition-colors
						{activeCategory === cat.category
                        ? 'bg-primary/10 text-primary border-primary border-b-2'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'}"
                >
                    {cat.title}
                </button>
            {/each}
        </div>

        <!-- 이모티콘 그리드 -->
        <div class="max-h-48 overflow-y-auto p-2">
            <div
                class="grid gap-0.5"
                style="grid-template-columns: repeat({activeCategory === 'emoji'
                    ? 9
                    : 6}, minmax(0, 1fr));"
            >
                {#each categoryEmoticons as emo (emo.reaction)}
                    <button
                        type="button"
                        onclick={() => react(emo.reaction, 'add')}
                        disabled={isReacting}
                        class="hover:bg-accent group/emo relative flex items-center justify-center rounded-lg p-1 transition-all hover:scale-110"
                        title={emo.emoji || emo.reaction}
                    >
                        {#if emo.renderType === 'image' && emo.url}
                            <img
                                src={emo.url}
                                alt={emo.reaction}
                                class="h-7 w-7 object-scale-down transition-transform group-hover/emo:z-50 group-hover/emo:scale-[4]"
                            />
                        {:else}
                            <span class="text-xl leading-none">{emo.emoji}</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>
    </div>
{/if}

<style>
    .da-reaction-badge:active {
        transform: scale(0.95);
    }
</style>
