<script lang="ts">
    /**
     * 관리자 전용 게시판 목록 레이아웃 변경 드롭다운
     *
     * 게시판 페이지 상단에 표시되며, 관리자가 즉시 레이아웃을 변경할 수 있다.
     * 변경 즉시 API에 저장되고 페이지가 새로고침된다.
     * 레이아웃 목록은 layoutRegistry에서 동적으로 가져온다.
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
    import ImageIcon from '@lucide/svelte/icons/image';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import TableProperties from '@lucide/svelte/icons/table-properties';
    import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import PartyPopper from '@lucide/svelte/icons/party-popper';
    import Gift from '@lucide/svelte/icons/gift';
    import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
    import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
    import { apiClient } from '$lib/api';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { layoutRegistry, initCoreLayouts } from './layouts/index.js';
    import type { Component } from 'svelte';

    // 코어 레이아웃 초기화 (중복 호출 안전)
    initCoreLayouts();

    interface Props {
        boardId: string;
        currentLayout: string;
    }

    let { boardId, currentLayout }: Props = $props();

    let isOpen = $state(false);
    let saving = $state<string | null>(null);
    let mounted = $state(false);

    // 클라이언트 마운트 후에만 표시 (hydration 안전)
    $effect(() => {
        mounted = true;
    });

    // 관리자 여부
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);

    // 레이아웃 ID별 아이콘 매핑
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iconMap: Record<string, Component<any>> = {
        compact: AlignJustify,
        card: LayoutGrid,
        detailed: List,
        gallery: ImageIcon,
        webzine: Newspaper,
        classic: TableProperties,
        'poster-gallery': ImageIcon,
        'market-card': ShoppingBag,
        notice: Megaphone,
        message: PartyPopper,
        giving: Gift,
        trade: ArrowLeftRight
    };

    // 레지스트리에서 동적으로 레이아웃 목록 생성
    const layouts = $derived.by(() => {
        const manifests = layoutRegistry.getListManifests();
        return manifests.map((m) => ({
            id: m.id,
            label: m.name,
            description: m.description,
            icon: iconMap[m.id] || LayoutDashboard
        }));
    });

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
                body: JSON.stringify({ list_layout: layoutId })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => null);
                throw new Error(err?.error?.message || `HTTP ${response.status}`);
            }

            close();
            await invalidateAll();
        } catch (error) {
            console.error('레이아웃 변경 실패:', error);
            if (browser) {
                alert(error instanceof Error ? error.message : '레이아웃 변경에 실패했습니다.');
            }
        } finally {
            saving = null;
        }
    }

    // 바깥 클릭 시 닫기
    function handleClickOutside(event: MouseEvent) {
        if (!isOpen) return;
        const target = event.target as HTMLElement;
        if (!target.closest('.admin-layout-switcher')) {
            close();
        }
    }
</script>

<svelte:window onclick={handleClickOutside} />

{#if mounted && isAdmin}
    <div class="admin-layout-switcher relative inline-block">
        <!-- 트리거 버튼: 현재 레이아웃 이름 표시 -->
        <button
            type="button"
            class="border-border hover:border-primary/40 hover:bg-accent flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
            onclick={toggle}
            title="게시판 목록 레이아웃 변경 (관리자)"
        >
            {#if activeLayout}
                {@const ActiveIcon = activeLayout.icon}
                <ActiveIcon class="text-primary h-3.5 w-3.5" />
                <span class="text-foreground font-medium">{activeLayout.label}</span>
            {:else}
                <LayoutDashboard class="text-muted-foreground h-3.5 w-3.5" />
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
                class="bg-popover border-border absolute left-0 z-50 mt-1.5 w-56 rounded-lg border py-1.5 shadow-xl"
            >
                <div
                    class="text-muted-foreground border-border mb-1 border-b px-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider"
                >
                    목록 레이아웃
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
                            {#if layout.description}
                                <p class="text-muted-foreground mt-0.5 text-[11px] leading-tight">
                                    {layout.description}
                                </p>
                            {/if}
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
