<script lang="ts">
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import { getWidgetName, getWidgetIcon } from './registry';
    import GripVertical from '@lucide/svelte/icons/grip-vertical';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import Eye from '@lucide/svelte/icons/eye';
    import type { Snippet } from 'svelte';

    interface Props {
        widget: WidgetConfig;
        children: Snippet;
    }

    const { widget, children }: Props = $props();

    const isEditMode = $derived(widgetLayoutStore.isEditMode);

    function handleRemove() {
        if (confirm(`'${getWidgetName(widget.type)}' 위젯을 삭제하시겠습니까?`)) {
            widgetLayoutStore.removeWidget(widget.id);
        }
    }

    function handleToggle() {
        widgetLayoutStore.toggleWidget(widget.id);
    }
</script>

<div
    class="widget-wrapper relative {isEditMode
        ? 'ring-dashed rounded-lg ring-2 ring-blue-400/50'
        : ''} {!widget.enabled && isEditMode ? 'opacity-50' : ''}"
>
    {#if isEditMode}
        <!-- 편집 모드 오버레이 -->
        <div class="absolute -top-3 left-0 right-0 z-10 flex items-center justify-between px-2">
            <!-- 드래그 핸들 & 위젯 이름 -->
            <div
                class="drag-handle flex cursor-grab items-center gap-1 rounded bg-blue-500 px-2 py-0.5 text-xs font-medium text-white active:cursor-grabbing"
            >
                <GripVertical class="h-3 w-3" />
                <span>{getWidgetName(widget.type)}</span>
            </div>

            <!-- 위젯 액션 버튼 -->
            <div class="flex items-center gap-1">
                <button
                    type="button"
                    onclick={handleToggle}
                    class="rounded bg-gray-100 p-1 text-gray-600 transition-colors hover:bg-gray-200"
                    title={widget.enabled ? '숨기기' : '표시'}
                >
                    {#if widget.enabled}
                        <Eye class="h-3.5 w-3.5" />
                    {:else}
                        <EyeOff class="h-3.5 w-3.5" />
                    {/if}
                </button>
                <button
                    type="button"
                    onclick={handleRemove}
                    class="rounded bg-red-100 p-1 text-red-600 transition-colors hover:bg-red-200"
                    title="삭제"
                >
                    <Trash2 class="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    {/if}

    <!-- 위젯 콘텐츠 -->
    <div class={isEditMode ? 'pt-4' : ''}>
        {#if widget.enabled || isEditMode}
            {@render children()}
        {/if}
    </div>
</div>

<style>
    .widget-wrapper {
        transition: all 0.2s ease;
    }

    :global(.widget-wrapper.dragging) {
        opacity: 0.5;
        transform: scale(0.98);
    }
</style>
