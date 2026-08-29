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

    /**
     * 피커에서 지금 호버(또는 포커스)된 이모티콘. 이 1개만 움직이는 파생본으로 바꾼다.
     * ⛔ 그리드 전체를 애니로 두면 44개 = 812KB 를 한 번에 받는다. 호버는 1개씩이라 싸다.
     */
    let hoveredEmoticon = $state<string | null>(null);

    /**
     * 호버 미리보기용 애니메이션 URL. 앙티콘이 아니거나 모션 최소화 설정이면 null 을 돌려
     * 정지 썸네일을 그대로 쓰게 한다.
     *
     * ⛔ 모션 최소화 판정을 모듈 최상단이나 $derived 로 올리지 마라 — 이 컴포넌트는 SSR 로도
     *    그려지는데 window 가 없다. 호버는 클라이언트에서만 일어나므로 여기서 보면 안전하다.
     */
    function animatedUrlFor(emo: { reaction: string; url?: string }): string | null {
        if (
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return null;
        }
        const animated = getReactionDisplay(emo.reaction).url;
        return animated && animated !== emo.url ? animated : null;
    }
    let showPicker = $state(false);
    let activeCategory = $state('angticon');
    let pickerStyle = $state('');
    let addBtnEl: HTMLButtonElement | undefined = $state();
    let pickerEl: HTMLDivElement | undefined = $state();

    // Escape 로 피커 닫기.
    // 종전엔 피커 div 의 onkeydown 만 있었는데, 열 때 focus 를 주지 않아
    // 키 이벤트가 그 div 에 도달하지 않았다 — 실제로는 닫히지 않았다(2026-08-11 감사).
    // 포커스 위치와 무관하게 동작하도록 window 에서 듣고, 접근성을 위해 피커에 포커스도 준다.
    $effect(() => {
        if (!showPicker) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') showPicker = false;
        };
        window.addEventListener('keydown', onKey);
        pickerEl?.focus({ preventScroll: true });
        return () => window.removeEventListener('keydown', onKey);
    });

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
    /**
     * 이모티콘 이미지가 404 일 때 대체 표시.
     *
     * ⛔ `import-image:` 리액션 76개 중 19개는 원본 파일이 **서버 어디에도 없다**
     *    (2026-08-29 전수 확인). 지우면 리액션 수가 줄어 이상해지므로 남기되,
     *    액박 대신 중립 아이콘을 보여준다.
     * ⛔ 대체 이미지도 실패하면 무한 루프가 되므로 한 번만 바꾼다.
     */
    const BROKEN_ICON =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">' +
                '<circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" ' +
                'stroke-width="1.5" opacity=".45"/>' +
                '<path d="M7 8.2a3 3 0 0 1 5.6 1.3c0 2-2.6 2.2-2.6 3.8" fill="none" ' +
                'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>' +
                '<circle cx="10" cy="15.4" r=".9" fill="currentColor" opacity=".45"/>' +
                '</svg>'
        );

    function handleIconError(event: Event) {
        const img = event.currentTarget as HTMLImageElement | null;
        if (!img || img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = BROKEN_ICON;
    }
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
                <!-- 움직이는 아이콘을 쓰되 모션 최소화 사용자에게는 정지본을 준다.
                     ⛔ JS(matchMedia)로 고르지 마라 — 이 바는 SSR 로 그려지므로
                        클라이언트에서 갈아끼우면 첫 페인트가 흔들린다. <source media> 는
                        브라우저가 첫 요청부터 골라주므로 왕복도 깜빡임도 없다. -->
                <picture class="contents">
                    {#if display.staticUrl}
                        <source
                            srcset={display.staticUrl}
                            media="(prefers-reduced-motion: reduce)"
                        />
                    {/if}
                    <img
                        src={display.url}
                        alt={display.label}
                        class="h-5 w-5 object-scale-down"
                        onerror={handleIconError}
                    />
                </picture>
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
        bind:this={pickerEl}
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
                    {@const previewUrl =
                        hoveredEmoticon === emo.reaction ? animatedUrlFor(emo) : null}
                    <button
                        type="button"
                        onclick={() => react(emo.reaction, 'add')}
                        onmouseenter={() => (hoveredEmoticon = emo.reaction)}
                        onmouseleave={() => (hoveredEmoticon = null)}
                        onfocus={() => (hoveredEmoticon = emo.reaction)}
                        onblur={() => (hoveredEmoticon = null)}
                        disabled={isReacting}
                        class="hover:bg-accent group/emo relative flex items-center justify-center rounded-lg p-1 transition-all hover:scale-110"
                        title={emo.emoji || emo.reaction}
                    >
                        {#if emo.renderType === 'image' && emo.url}
                            <!-- 첫 오픈 시 탭 전체(앙티콘 44개)가 한꺼번에 내려오던 것을 막는다.
                                 개별 파일이 최대 679KB 애니 GIF 라 합계 ~2.9MB 였다(2026-08-11 실측).
                                 그래서 그리드는 정지 썸네일을 쓰고, **호버한 1개만** 움직이는
                                 파생본으로 바꾼다(아래 4배 확대 미리보기가 살아난다).
                                 ⛔ 그리드 전체를 애니로 바꾸지 마라 — 44개 합계 812KB 다. -->
                            <img
                                src={previewUrl ?? emo.url}
                                alt={emo.reaction}
                                loading="lazy"
                                decoding="async"
                                class="pointer-events-none h-7 w-7 object-scale-down transition-transform [@media(hover:hover)]:group-hover/emo:z-50 [@media(hover:hover)]:group-hover/emo:scale-[4]"
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
