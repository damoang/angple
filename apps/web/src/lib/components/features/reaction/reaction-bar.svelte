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
    import { loadPluginLib } from '$lib/utils/plugin-optional-loader';
    import SmilePlus from '@lucide/svelte/icons/smile-plus';
    import Users from '@lucide/svelte/icons/users';
    import ReactionReactorsDialog from './reaction-reactors-dialog.svelte';
    import {
        canUseCertifiedAction,
        getCertificationBlockedMessage,
        goToCertification
    } from '$lib/utils/certification-gate.js';
    import { trackEvent } from '$lib/services/ga4.js';

    interface Props {
        boardId: string;
        postId: number | string;
        commentId?: number | string;
        target: 'post' | 'comment';
        initialReactions?: ReactionItem[];
    }

    interface ReactionPolicyModule {
        getBlockedReactions?: () => string[];
        isReactionBlocked?: (reaction: string) => boolean;
    }

    let { boardId, postId, commentId, target, initialReactions }: Props = $props();

    let reactions = $state<ReactionItem[]>([]);
    let blockedReactions = $state<string[]>([]);
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
        REACTION_EMOTICONS.filter(
            (e) =>
                e.category === activeCategory &&
                !isReactionBlocked(REACTION_REPLACE[e.reaction] || e.reaction)
        )
    );

    function isReactionBlocked(reaction: string): boolean {
        return blockedReactions.includes(reaction);
    }

    async function loadReactionPolicy(): Promise<void> {
        const policy = await loadPluginLib<ReactionPolicyModule>('da-reaction', 'reaction-policy');
        if (!policy) return;

        if (typeof policy.getBlockedReactions === 'function') {
            blockedReactions = policy.getBlockedReactions();
            return;
        }

        if (typeof policy.isReactionBlocked === 'function') {
            blockedReactions = REACTION_EMOTICONS.map(
                (e) => REACTION_REPLACE[e.reaction] || e.reaction
            ).filter((reaction) => policy.isReactionBlocked?.(reaction));
        }
    }

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
    // 낙관적 업데이트 계산: 누르는 즉시 카운트/선택 상태를 반영한다.
    // 서버 응답(data.result)으로 권위값 재조정하고, 실패 시 스냅샷으로 롤백한다.
    function computeOptimistic(
        list: ReactionItem[],
        reaction: string,
        mode: string
    ): ReactionItem[] {
        const idx = list.findIndex((r) => r.reaction === reaction);
        if (idx >= 0) {
            const item = list[idx];
            if (item.choose && mode !== 'add') {
                // 이미 선택됨 + 토글 → 해제(카운트-1, 0이면 제거)
                const nextCount = item.count - 1;
                if (nextCount <= 0) return list.filter((_, i) => i !== idx);
                return list.map((r, i) =>
                    i === idx ? { ...r, count: nextCount, choose: false } : r
                );
            }
            if (!item.choose) {
                // 미선택 → 선택(카운트+1)
                return list.map((r, i) =>
                    i === idx ? { ...r, count: r.count + 1, choose: true } : r
                );
            }
            // 이미 선택됨 + add 모드 → 변화 없음
            return list;
        }
        // 신규 리액션 추가
        const ci = reaction.indexOf(':');
        return [
            ...list,
            {
                reaction,
                category: ci >= 0 ? reaction.substring(0, ci) : reaction,
                reactionId: ci >= 0 ? reaction.substring(ci + 1) : reaction,
                count: 1,
                choose: true
            }
        ];
    }

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
        if (isReactionBlocked(finalReaction)) {
            isReacting = false;
            return;
        }

        // 낙관적 반영: 서버 왕복(정책·인증·다중쿼리)을 기다리지 않고 즉시 UI 갱신.
        const snapshot = reactions;
        reactions = computeOptimistic(reactions, finalReaction, mode);

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
                // 서버 권위값으로 재조정(동시 리액션 등으로 낙관값과 다를 수 있음).
                reactions = data.result[targetId];
                trackEvent('reaction', { board_id: boardId, reaction: finalReaction, target });
            } else {
                // 서버 거부(정책·한도 초과 등) → 롤백.
                reactions = snapshot;
            }
        } catch (err) {
            console.error('Failed to react:', err);
            reactions = snapshot; // 네트워크 실패 → 롤백
        } finally {
            isReacting = false;
        }
    }

    // 기존 리액션 클릭 (토글)
    function handleReactionClick(reaction: string): void {
        if (isReactionBlocked(reaction)) return;
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

    // initialReactions 반응적 감시 + 글 변경 시 리셋
    $effect(() => {
        // targetId 변경 시(글 이동) reactions를 즉시 리셋
        void targetId;
        reactions = initialReactions ?? [];
    });

    // 리액션 사용자 목록 다이얼로그 (이모지 닉네임 공개, 2026-07-12 시행)
    let reactorsDialogOpen = $state(false);

    onMount(() => {
        void loadReactionPolicy();
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });
</script>

<div class="reaction-bar-root relative inline-flex flex-wrap items-center gap-1.5">
    <!-- 기존 리액션 배지 -->
    {#each reactions as item (item.reaction)}
        {@const display = getReactionDisplay(item.reaction)}
        {@const blocked = isReactionBlocked(item.reaction)}
        <button
            type="button"
            onclick={() => handleReactionClick(item.reaction)}
            disabled={isReacting || blocked}
            class="da-reaction-badge group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-all
				{blocked
                ? 'border-border bg-muted/30 text-muted-foreground/70 cursor-not-allowed opacity-70'
                : item.choose
                  ? 'border-primary/50 bg-primary/10 text-primary ring-primary/20 ring-1'
                  : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5'}"
            title={blocked ? '현재 사용할 수 없는 리액션입니다.' : display.label}
        >
            {#if display.renderType === 'image' && display.url}
                <img src={display.url} alt={display.label} class="h-5 w-5 object-scale-down" />
            {:else}
                <span class="text-base leading-none">{display.emoji}</span>
            {/if}
            <span class="font-medium">{item.count}</span>
        </button>
    {/each}

    <!-- 리액션 사용자 목록 (닉네임 공개, 2026-07-12 시행) -->
    {#if reactions.length > 0 && authStore.isAuthenticated}
        <button
            type="button"
            onclick={() => (reactorsDialogOpen = true)}
            class="border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 inline-flex items-center rounded-full border px-2 py-1 transition-all"
            title="리액션한 사람 보기"
            aria-label="리액션한 사람 보기"
        >
            <Users class="h-4 w-4" />
        </button>
    {/if}

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

{#if reactorsDialogOpen}
    <ReactionReactorsDialog
        bind:open={reactorsDialogOpen}
        {targetId}
        onClose={() => (reactorsDialogOpen = false)}
    />
{/if}

<style>
    .da-reaction-badge:active {
        transform: scale(0.95);
    }
</style>
