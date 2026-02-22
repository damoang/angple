<script lang="ts">
    /**
     * 관리자 전용 레이아웃 변경 드롭다운
     *
     * 게시판 페이지 상단에 표시되며, 관리자가 즉시 레이아웃을 변경할 수 있다.
     * 변경 즉시 API에 저장되고 페이지가 새로고침된다.
     * 레이아웃 목록은 layoutRegistry에서 동적으로 가져온다.
     */

    import { invalidateAll } from '$app/navigation';
    import { browser } from '$app/environment';
    import Settings from '@lucide/svelte/icons/settings';
    import Check from '@lucide/svelte/icons/check';
    import AlignJustify from '@lucide/svelte/icons/align-justify';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';
    import List from '@lucide/svelte/icons/list';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import TableProperties from '@lucide/svelte/icons/table-properties';
    import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
    import { apiClient } from '$lib/api';
    import { layoutRegistry, initCoreLayouts } from './layouts/index.js';

    // 코어 레이아웃 초기화 (중복 호출 안전)
    initCoreLayouts();
    import type { Component } from 'svelte';

    interface Props {
        boardId: string;
        currentLayout: string;
    }

    let { boardId, currentLayout }: Props = $props();

    let isOpen = $state(false);
    let saving = $state<string | null>(null);

    // 레이아웃 ID별 아이콘 매핑 (알려진 레이아웃용)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const iconMap: Record<string, Component<any>> = {
        compact: AlignJustify,
        card: LayoutGrid,
        detailed: List,
        gallery: ImageIcon,
        webzine: Newspaper,
        classic: TableProperties,
        'poster-gallery': ImageIcon,
        'market-card': LayoutGrid
    };

    // 레지스트리에서 동적으로 레이아웃 목록 생성
    const layouts = $derived.by(() => {
        const manifests = layoutRegistry.getListManifests();
        return manifests.map((m) => ({
            id: m.id,
            label: m.name,
            icon: iconMap[m.id] || LayoutDashboard
        }));
    });

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

            // 성공: 페이지 데이터 무효화하여 새 레이아웃 적용
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
        const target = event.target as HTMLElement;
        if (!target.closest('.admin-layout-switcher')) {
            close();
        }
    }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="admin-layout-switcher relative">
    <button
        type="button"
        class="text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
        onclick={toggle}
        title="레이아웃 변경 (관리자)"
    >
        <Settings class="h-3.5 w-3.5" />
        <span>레이아웃</span>
    </button>

    {#if isOpen}
        <div
            class="bg-popover border-border absolute right-0 z-50 mt-1 w-44 rounded-md border py-1 shadow-lg"
        >
            {#each layouts as layout (layout.id)}
                {@const Icon = layout.icon}
                {@const isActive = layout.id === currentLayout}
                {@const isSaving = saving === layout.id}
                <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors
                        {isActive
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-muted text-foreground'}"
                    onclick={() => selectLayout(layout.id)}
                    disabled={isSaving}
                >
                    <Icon class="h-4 w-4 shrink-0" />
                    <span class="flex-1 text-left">{layout.label}</span>
                    {#if isSaving}
                        <span class="text-muted-foreground text-xs">저장...</span>
                    {:else if isActive}
                        <Check class="h-3.5 w-3.5 shrink-0" />
                    {/if}
                </button>
            {/each}
        </div>
    {/if}
</div>
