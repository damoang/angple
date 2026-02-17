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

    interface Props {
        boardId: string;
        postId: number | string;
        commentId?: number | string;
        target: 'post' | 'comment';
    }

    let { boardId, postId, commentId, target }: Props = $props();

    let reactions = $state<ReactionItem[]>([]);
    let isLoading = $state(false);
    let isReacting = $state(false);
    let showPicker = $state(false);
    let activeCategory = $state('angticon');

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

    // 피커 외부 클릭
    function handleClickOutside(event: MouseEvent): void {
        const el = event.target as HTMLElement;
        if (!el.closest('.reaction-bar-root')) {
            showPicker = false;
        }
    }

    onMount(() => {
        loadReactions();
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
            class="da-reaction-badge inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all
				{item.choose
                ? 'border-primary/50 bg-primary/10 text-primary ring-primary/20 ring-1'
                : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5'}"
            title={display.label}
        >
            {#if display.renderType === 'image' && display.url}
                <img
                    src={display.url}
                    alt={display.label}
                    class="h-4 w-4 object-contain"
                    loading="lazy"
                />
            {:else}
                <span class="text-sm leading-none">{display.emoji}</span>
            {/if}
            <span class="font-medium">{item.count}</span>
        </button>
    {/each}

    <!-- 리액션 추가 버튼 -->
    <button
        type="button"
        onclick={(e) => {
            e.stopPropagation();
            if (!authStore.isAuthenticated) {
                authStore.redirectToLogin();
                return;
            }
            showPicker = !showPicker;
        }}
        class="border-border bg-muted/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition-colors"
        title="리액션 추가"
    >
        <SmilePlus class="h-3.5 w-3.5" />
    </button>

    <!-- 이모티콘 피커 -->
    {#if showPicker}
        <div
            class="bg-popover border-border absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl border shadow-xl"
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
                    class="grid grid-cols-{activeCategory === 'emoji' ? '9' : '6'} gap-0.5"
                    style="grid-template-columns: repeat({activeCategory === 'emoji'
                        ? 9
                        : 6}, minmax(0, 1fr));"
                >
                    {#each categoryEmoticons as emo (emo.reaction)}
                        <button
                            type="button"
                            onclick={() => react(emo.reaction, 'add')}
                            disabled={isReacting}
                            class="hover:bg-accent flex items-center justify-center rounded-lg p-1 transition-all hover:scale-110"
                            title={emo.emoji || emo.reaction}
                        >
                            {#if emo.renderType === 'image' && emo.url}
                                <img
                                    src={emo.url}
                                    alt={emo.reaction}
                                    class="h-7 w-7 object-contain"
                                    loading="lazy"
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
</div>

<style>
    .da-reaction-badge:active {
        transform: scale(0.95);
    }
</style>
