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

<!-- grid 자동배치 → flex (#free-6824455 확장 주입 면역, empathy-explore-row 와 동일). gap-4 절반 보정 = 0.5rem -->
<div class="flex flex-col gap-4 lg:flex-row lg:flex-wrap">
    <div class="min-w-0 lg:w-[calc(50%-0.5rem)]">
        <NewBoard posts={indexWidgetsStore.newsTabs} />
    </div>
    <div class="min-w-0 lg:w-[calc(50%-0.5rem)]">
        <EconomyTabs posts={indexWidgetsStore.economyTabs} />
    </div>
</div>
