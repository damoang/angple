<script lang="ts">
    /**
     * 게시판 뷰 모드 스위처
     *
     * Reddit식 뷰 토글 (list/card/gallery/compact/timeline)
     */

    import { boardViewStore, VIEW_MODES, type BoardViewMode } from '$lib/stores/board-view.svelte';
    import List from '@lucide/svelte/icons/list';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';
    import ImageIcon from '@lucide/svelte/icons/image';
    import AlignJustify from '@lucide/svelte/icons/align-justify';
    import Clock from '@lucide/svelte/icons/clock';

    interface Props {
        boardId: string;
        /** 사용 가능한 뷰 모드 제한 (기본: 전체) */
        allowedModes?: BoardViewMode[];
    }

    let { boardId, allowedModes }: Props = $props();

    const currentMode = $derived(boardViewStore.getViewMode(boardId));

    const availableModes = $derived(
        allowedModes
            ? VIEW_MODES.filter(m => allowedModes.includes(m.id))
            : VIEW_MODES
    );

    function setMode(mode: BoardViewMode) {
        boardViewStore.setViewMode(boardId, mode);
    }

    /** 아이콘 매핑 */
    const iconMap: Record<string, typeof List> = {
        'list': List,
        'layout-grid': LayoutGrid,
        'image': ImageIcon,
        'align-justify': AlignJustify,
        'clock': Clock
    };
</script>

<div class="flex items-center gap-1 rounded-lg border p-1" role="radiogroup" aria-label="뷰 모드">
    {#each availableModes as mode (mode.id)}
        {@const Icon = iconMap[mode.icon]}
        <button
            type="button"
            role="radio"
            aria-checked={currentMode === mode.id}
            aria-label={mode.label}
            title={mode.description}
            class="rounded-md p-1.5 transition-colors {currentMode === mode.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => setMode(mode.id)}
        >
            {#if Icon}
                <Icon class="h-4 w-4" />
            {/if}
        </button>
    {/each}
</div>
