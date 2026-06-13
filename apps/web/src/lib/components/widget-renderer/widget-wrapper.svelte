<script lang="ts">
    /**
     * 통합 위젯 래퍼
     *
     * 편집 모드에서 드래그 핸들, 토글, 삭제 버튼 등
     * 위젯 관리 UI를 제공합니다.
     */
    import { widgetLayoutStore, type WidgetConfig } from '$lib/stores/widget-layout.svelte';
    import { getWidgetName } from '$lib/utils/widget-component-loader';

    import GripVertical from '@lucide/svelte/icons/grip-vertical';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import Eye from '@lucide/svelte/icons/eye';
    import SettingsIcon from '@lucide/svelte/icons/settings';
    import WidgetSettingsDialog from '$lib/components/features/widget-editor/widget-settings-dialog.svelte';
    import type { Snippet } from 'svelte';

    interface Props {
        widget: WidgetConfig;
        zone: 'main' | 'sidebar';
        children: Snippet;
    }

    const { widget, zone, children }: Props = $props();

    const isEditMode = $derived(widgetLayoutStore.isEditMode);
    let settingsOpen = $state(false);

    function handleRemove() {
        if (confirm(`'${getWidgetName(widget.type)}' 위젯을 삭제하시겠습니까?`)) {
            if (zone === 'sidebar') {
                widgetLayoutStore.removeSidebarWidget(widget.id);
            } else {
                widgetLayoutStore.removeWidget(widget.id);
            }
        }
    }

    function handleToggle() {
        if (zone === 'sidebar') {
            widgetLayoutStore.toggleSidebarWidget(widget.id);
        } else {
            widgetLayoutStore.toggleWidget(widget.id);
        }
    }
</script>

<div
    class="widget-wrapper group/widget relative {isEditMode
        ? 'ring-dashed ring-primary/40 rounded-lg ring-2'
        : ''} {!widget.enabled && isEditMode ? 'opacity-50' : ''}"
>
    {#if isEditMode}
        <!-- 편집 모드 오버레이 -->
        <div class="absolute -top-3 left-0 right-0 z-10 flex items-center justify-between px-2">
            <!-- 드래그 핸들 & 위젯 이름 -->
            <div
                class="drag-handle bg-primary text-primary-foreground flex cursor-grab items-center gap-1 rounded px-2 py-0.5 text-xs font-medium active:cursor-grabbing"
            >
                <GripVertical class="h-3 w-3" />
                <span>{getWidgetName(widget.type)}</span>
            </div>

            <!-- 위젯 액션 버튼 -->
            <div class="flex items-center gap-1">
                <button
                    type="button"
                    onclick={() => (settingsOpen = true)}
                    class="bg-muted text-muted-foreground hover:bg-accent rounded p-1 transition-all duration-200 ease-out"
                    title="설정"
                >
                    <SettingsIcon class="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onclick={handleToggle}
                    class="bg-muted text-muted-foreground hover:bg-accent rounded p-1 transition-all duration-200 ease-out"
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
                    class="text-destructive bg-destructive/10 hover:bg-destructive/20 rounded p-1 transition-all duration-200 ease-out"
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
            <!--
              Phase 14 Tier 1 T1.2 — widget-level error isolation (Svelte 5 boundary).
              각 widget 의 render throw 가 다른 widget / 페이지 영향 0.
              multi-tenant 빈 사이트 (ipyang/nuna/tektok) 의 widget data null → undefined access 방어.
            -->
            <svelte:boundary
                onerror={(err) => console.error('[Widget Boundary]', widget.type, err)}
            >
                {@render children()}
                {#snippet failed(error, reset)}
                    <div
                        class="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                    >
                        <p class="font-medium">위젯을 일시적으로 불러올 수 없습니다.</p>
                        <p class="mt-1 text-xs opacity-70">
                            {widget.type}
                            {#if isEditMode}— {String(error)}{/if}
                        </p>
                        <button onclick={reset} class="mt-2 text-xs underline hover:text-amber-900">
                            다시 시도
                        </button>
                    </div>
                {/snippet}
            </svelte:boundary>
        {/if}
    </div>
</div>

{#if isEditMode}
    <WidgetSettingsDialog
        {widget}
        {zone}
        open={settingsOpen}
        onOpenChange={(v) => (settingsOpen = v)}
    />
{/if}

<style>
    .widget-wrapper {
        transition: all 0.2s ease;
    }

    :global(.widget-wrapper.dragging) {
        opacity: 0.5;
        transform: scale(0.98);
    }
</style>
