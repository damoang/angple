<script lang="ts">
    import type { RecommendedPeriod } from '$lib/api/types.js';
    import { getCurrentTabVisibility } from '../../utils/index.js';

    let {
        activeTab = $bindable(),
        onTabChange
    }: {
        activeTab: RecommendedPeriod;
        onTabChange: (tabId: RecommendedPeriod) => void;
    } = $props();

    const { show1H, show3H } = getCurrentTabVisibility();

    const tabs: { id: RecommendedPeriod; label: string; hidden?: boolean }[] = [
        { id: '1h', label: '1시간', hidden: !show1H },
        { id: '3h', label: '3시간', hidden: !show3H },
        { id: '6h', label: '6시간' },
        { id: '12h', label: '12시간' },
        { id: '24h', label: '24시간' },
        { id: '48h', label: '48시간' }
    ];

    function handleClick(tabId: RecommendedPeriod) {
        activeTab = tabId;
        onTabChange(tabId);
    }
</script>

<!-- Pill 스타일 탭 (모바일: 가로 스크롤) -->
<div class="flex gap-1 overflow-x-auto" style="-ms-overflow-style:none;scrollbar-width:none">
    {#each tabs as tab (tab.id)}
        {#if !tab.hidden}
            <button
                type="button"
                class="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-all duration-200 ease-out sm:px-2.5 sm:text-[15px]
                    {activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                onclick={() => handleClick(tab.id)}
            >
                {tab.label}
            </button>
        {/if}
    {/each}
</div>
