<script lang="ts">
    import { customizerStore, type CustomizerSection } from '$lib/stores/admin-customizer.svelte';
    import X from '@lucide/svelte/icons/x';
    import PanelTop from '@lucide/svelte/icons/panel-top';
    import PanelLeft from '@lucide/svelte/icons/panel-left';
    import Columns3 from '@lucide/svelte/icons/columns-3';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';

    const activeSection = $derived(customizerStore.activeSection);

    const sections: { id: CustomizerSection; label: string; icon: typeof PanelTop }[] = [
        { id: 'header', label: '상단', icon: PanelTop },
        { id: 'sidebar', label: '사이드', icon: PanelLeft },
        { id: 'mega', label: '펼침', icon: Columns3 },
        { id: 'widgets', label: '위젯', icon: LayoutGrid }
    ];
</script>

<div class="border-border flex items-center justify-between border-b px-4 py-3">
    <h2 class="text-sm font-semibold">커스터마이저</h2>
    <button
        type="button"
        onclick={() => customizerStore.close()}
        class="hover:bg-muted rounded-md p-1 transition-colors"
        title="닫기"
    >
        <X class="h-4 w-4" />
    </button>
</div>

<!-- 섹션 탭 -->
<div class="border-border flex border-b">
    {#each sections as section}
        <button
            type="button"
            onclick={() => customizerStore.setSection(section.id)}
            class="flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-xs transition-colors {activeSection ===
            section.id
                ? 'border-primary text-primary border-b-2 font-medium'
                : 'text-muted-foreground hover:text-foreground'}"
        >
            <section.icon class="h-4 w-4" />
            {section.label}
        </button>
    {/each}
</div>
