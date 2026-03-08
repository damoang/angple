<script lang="ts">
    import { customizerStore, type CustomizerSection } from '$lib/stores/admin-customizer.svelte';
    import X from '@lucide/svelte/icons/x';
    import PanelTop from '@lucide/svelte/icons/panel-top';
    import PanelLeft from '@lucide/svelte/icons/panel-left';
    import Columns3 from '@lucide/svelte/icons/columns-3';
    import LayoutGrid from '@lucide/svelte/icons/layout-grid';

    const activeSection = $derived(customizerStore.activeSection);

    function setTab(id: CustomizerSection) {
        customizerStore.setSection(id);
    }

    function tabClass(id: CustomizerSection): string {
        const base = 'flex flex-1 flex-col items-center gap-1 px-2 py-3 text-xs transition-colors';
        if (activeSection === id) {
            return `${base} border-b-2 border-primary text-primary font-medium`;
        }
        return `${base} text-muted-foreground hover:text-foreground`;
    }
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
<div class="border-border flex border-b" role="tablist">
    <button type="button" role="tab" class={tabClass('header')} onclick={() => setTab('header')}>
        <PanelTop class="h-4 w-4" />
        <span>상단</span>
    </button>
    <button type="button" role="tab" class={tabClass('sidebar')} onclick={() => setTab('sidebar')}>
        <PanelLeft class="h-4 w-4" />
        <span>사이드</span>
    </button>
    <button type="button" role="tab" class={tabClass('mega')} onclick={() => setTab('mega')}>
        <Columns3 class="h-4 w-4" />
        <span>펼침</span>
    </button>
    <button type="button" role="tab" class={tabClass('widgets')} onclick={() => setTab('widgets')}>
        <LayoutGrid class="h-4 w-4" />
        <span>위젯</span>
    </button>
</div>
