<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import { AVAILABLE_BOARDS, BOARD_FILTERABLE_WIDGET_TYPES } from '$lib/types/widget-settings';
    import Save from '@lucide/svelte/icons/save';

    interface Props {
        widget: WidgetConfig;
        zone: 'main' | 'sidebar';
        open: boolean;
        onOpenChange: (open: boolean) => void;
    }

    const { widget, zone, open, onOpenChange }: Props = $props();

    // 로컬 설정 상태
    let boardId = $state((widget.settings?.boardId as string) ?? '');
    let limit = $state((widget.settings?.limit as number) ?? 10);
    let sortBy = $state((widget.settings?.sortBy as string) ?? 'latest');

    const isBoardFilterable = $derived(
        BOARD_FILTERABLE_WIDGET_TYPES.includes(
            widget.type as (typeof BOARD_FILTERABLE_WIDGET_TYPES)[number]
        )
    );

    function handleSave() {
        const newSettings = { ...widget.settings };
        if (isBoardFilterable) {
            if (boardId) newSettings.boardId = boardId;
            else delete newSettings.boardId;
            newSettings.limit = limit;
            newSettings.sortBy = sortBy;
        }
        widget.settings = newSettings;
        onOpenChange(false);
    }

    // widget이 변경되면 로컬 상태도 업데이트
    $effect(() => {
        boardId = (widget.settings?.boardId as string) ?? '';
        limit = (widget.settings?.limit as number) ?? 10;
        sortBy = (widget.settings?.sortBy as string) ?? 'latest';
    });
</script>

<Dialog.Root {open} {onOpenChange}>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>위젯 설정</Dialog.Title>
            <Dialog.Description>위젯의 데이터 소스와 표시 옵션을 설정합니다.</Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 py-4">
            {#if isBoardFilterable}
                <div class="space-y-2">
                    <Label for="boardId">게시판</Label>
                    <select
                        id="boardId"
                        bind:value={boardId}
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                        <option value="">전체 (기본)</option>
                        {#each AVAILABLE_BOARDS as board (board.id)}
                            <option value={board.id}>{board.name}</option>
                        {/each}
                    </select>
                </div>

                <div class="space-y-2">
                    <Label for="limit">표시 글 수</Label>
                    <Input id="limit" type="number" min={1} max={50} bind:value={limit} />
                </div>

                <div class="space-y-2">
                    <Label for="sortBy">정렬</Label>
                    <select
                        id="sortBy"
                        bind:value={sortBy}
                        class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                        <option value="latest">최신순</option>
                        <option value="popular">인기순</option>
                        <option value="recommended">추천순</option>
                    </select>
                </div>
            {:else}
                <p class="text-muted-foreground text-sm">이 위젯은 추가 설정이 없습니다.</p>
            {/if}
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => onOpenChange(false)}>취소</Button>
            {#if isBoardFilterable}
                <Button onclick={handleSave}>
                    <Save class="mr-2 h-4 w-4" />
                    적용
                </Button>
            {/if}
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
