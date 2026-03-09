<script lang="ts">
    /**
     * 관리자 전용 댓글 레이아웃 변경 드롭다운
     *
     * 게시글 본문 페이지의 댓글 영역 헤더에 표시되며,
     * 관리자가 즉시 댓글 레이아웃을 변경할 수 있다.
     * 변경 즉시 API에 저장되고 페이지가 새로고침된다.
     *
     * 컴포넌트 내부에서 authStore를 통해 관리자 여부를 확인하므로,
     * 부모에서 {#if} 조건 없이 항상 렌더링해도 됨 (SSR hydration 안전).
     */

    import { invalidateAll } from '$app/navigation';
    import { browser } from '$app/environment';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import Check from '@lucide/svelte/icons/check';
    import AlignJustify from '@lucide/svelte/icons/align-justify';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';
    import List from '@lucide/svelte/icons/list';
    import MessageCircle from '@lucide/svelte/icons/message-circle';
    import MessagesSquare from '@lucide/svelte/icons/messages-square';
    import Minus from '@lucide/svelte/icons/minus';
    import { apiClient } from '$lib/api';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { Component } from 'svelte';

    interface Props {
        boardId: string;
        currentLayout: string;
        onLayoutChange?: (layoutId: string) => void;
    }

    let { boardId, currentLayout, onLayoutChange }: Props = $props();

    let isOpen = $state(false);
    let saving = $state<string | null>(null);
    let mounted = $state(false);

    // 클라이언트 마운트 후에만 표시 (hydration 안전)
    $effect(() => {
        mounted = true;
    });

    // 관리자 여부
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);

    // 댓글 레이아웃 옵션
    const layouts: { id: string; label: string; description: string; icon: Component<any> }[] = [
        { id: 'flat', label: '기본', description: '구분 없는 평면 목록', icon: AlignJustify },
        { id: 'bordered', label: '카드형', description: '테두리 카드로 구분', icon: LayoutGrid },
        { id: 'divided', label: '구분선형', description: '구분선으로 나누기', icon: List },
        {
            id: 'bubble',
            label: '말풍선형',
            description: '작성자 방향별 말풍선',
            icon: MessageCircle
        },
        { id: 'chat', label: '채팅형', description: '채팅앱 스타일 버블', icon: MessagesSquare },
        { id: 'compact', label: '컴팩트', description: '최소 여백 밀집 배치', icon: Minus }
    ];

    // 현재 활성 레이아웃 정보
    const activeLayout = $derived(layouts.find((l) => l.id === currentLayout));

    function toggle() {
        isOpen = !isOpen;
    }

    function close() {
        isOpen = false;
    }

    async function selectLayout(layoutId: string) {
        if (layoutId === currentLayout) {
            close();
            return;
        }

        saving = layoutId;

        try {
            const token = apiClient.getAccessToken();
            const response = await fetch(`/api/v1/boards/${boardId}/display-settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                credentials: 'include',
                body: JSON.stringify({ comment_layout: layoutId })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                throw new Error(err?.error?.message || `HTTP ${response.status}`);
            }

            close();
            // 부모에 즉시 레이아웃 변경 반영
            onLayoutChange?.(layoutId);
            // 서버 캐시 무효화 후 페이지 데이터 새로고침
            await fetch(`/api/boards/${boardId}/invalidate-cache`, { method: 'POST' });
            await invalidateAll();
        } catch (error) {
            console.error('댓글 레이아웃 변경 실패:', error);
            if (browser) {
                alert(
                    error instanceof Error ? error.message : '댓글 레이아웃 변경에 실패했습니다.'
                );
            }
        } finally {
            saving = null;
        }
    }

    // 바깥 클릭 시 닫기
    function handleClickOutside(event: MouseEvent) {
        if (!isOpen) return;
        const target = event.target as HTMLElement;
        if (!target.closest('.admin-comment-layout-switcher')) {
            close();
        }
    }
</script>

<svelte:window onclick={handleClickOutside} />

{#if mounted && isAdmin}
    <div class="admin-comment-layout-switcher relative inline-block">
        <!-- 트리거 버튼: 현재 댓글 레이아웃 이름 표시 -->
        <button
            type="button"
            class="border-border hover:border-primary/40 hover:bg-accent flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
            onclick={toggle}
            title="댓글 레이아웃 변경 (관리자)"
        >
            {#if activeLayout}
                {@const ActiveIcon = activeLayout.icon}
                <ActiveIcon class="text-primary h-3.5 w-3.5" />
                <span class="text-foreground font-medium">{activeLayout.label}</span>
            {:else}
                <AlignJustify class="text-muted-foreground h-3.5 w-3.5" />
                <span class="text-muted-foreground">레이아웃</span>
            {/if}
            <ChevronDown
                class="text-muted-foreground h-3 w-3 transition-transform {isOpen
                    ? 'rotate-180'
                    : ''}"
            />
        </button>

        {#if isOpen}
            <div
                class="bg-popover border-border absolute right-0 z-50 mt-1.5 w-52 rounded-lg border py-1.5 shadow-xl"
            >
                <div
                    class="text-muted-foreground border-border mb-1 border-b px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider"
                >
                    댓글 레이아웃
                </div>
                {#each layouts as layout (layout.id)}
                    {@const Icon = layout.icon}
                    {@const isActive = layout.id === currentLayout}
                    {@const isSaving = saving === layout.id}
                    <button
                        type="button"
                        class="group flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors
                            {isActive
                            ? 'bg-primary/5 text-foreground'
                            : 'hover:bg-muted text-foreground'}"
                        onclick={() => selectLayout(layout.id)}
                        disabled={isSaving}
                    >
                        <Icon
                            class="h-4 w-4 shrink-0 {isActive
                                ? 'text-primary'
                                : 'text-muted-foreground group-hover:text-foreground'}"
                        />
                        <div class="flex-1 text-left">
                            <span class={isActive ? 'font-medium' : ''}>{layout.label}</span>
                            <p class="text-muted-foreground mt-0.5 text-[11px] leading-tight">
                                {layout.description}
                            </p>
                        </div>
                        {#if isSaving}
                            <span class="text-muted-foreground animate-pulse text-xs">저장...</span>
                        {:else if isActive}
                            <Check class="text-primary h-4 w-4 shrink-0" />
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}
    </div>
{/if}
