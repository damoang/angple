<script lang="ts">
    /**
     * 새로운 소식 + 알뜰구매 2컬럼 결합 위젯
     * PC(lg+): 나란히 배치, 모바일: 세로 스택
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { NewBoard } from '$lib/components/features/new-board';
    import { EconomyTabs } from '$lib/components/features/economy';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();
</script>

<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <NewBoard posts={indexWidgetsStore.newsTabs} />
    <EconomyTabs posts={indexWidgetsStore.economyTabs} />
</div>
