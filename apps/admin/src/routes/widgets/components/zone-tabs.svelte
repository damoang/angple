<script lang="ts">
    import { widgetStore, type WidgetZone } from '$lib/stores/widget-store.svelte';
    import { cn } from '$lib/utils';
    import { LayoutGrid, PanelRight } from '@lucide/svelte/icons';

    /**
     * 위젯 영역 탭 컴포넌트
     *
     * 메인 영역과 사이드바 영역을 선택합니다.
     */

    const selectedZone = $derived(widgetStore.selectedZone);
    const mainWidgetsCount = $derived(widgetStore.widgets.length);
    const sidebarWidgetsCount = $derived(widgetStore.sidebarWidgets.length);

    function selectZone(zone: WidgetZone) {
        widgetStore.selectZone(zone);
    }

    const tabs = [
        {
            id: 'main' as const,
            label: '메인 영역',
            icon: LayoutGrid,
            get count() {
                return mainWidgetsCount;
            }
        },
        {
            id: 'sidebar' as const,
            label: '사이드바',
            icon: PanelRight,
            get count() {
                return sidebarWidgetsCount;
            }
        }
    ];
</script>

<div class="inline-flex rounded-lg border p-1">
    {#each tabs as tab (tab.id)}
        {@const Icon = tab.icon}
        {@const isActive = selectedZone === tab.id}
        <button
            type="button"
            onclick={() => selectZone(tab.id)}
            class={cn(
                'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
        >
            <Icon class="h-4 w-4" />
            <span>{tab.label}</span>
            <span
                class={cn(
                    'rounded-full px-2 py-0.5 text-xs',
                    isActive ? 'bg-primary-foreground/20' : 'bg-muted'
                )}
            >
                {tab.count}
            </span>
        </button>
    {/each}
</div>
