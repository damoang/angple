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

<!-- PHP nav-tabs-bottomline 스타일 -->
<div class="flex border-b border-gray-200 dark:border-gray-700">
    {#each tabs as tab}
        {#if !tab.hidden}
            <button
                type="button"
                class="relative px-3 py-2 text-sm font-medium transition-colors
                    {activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'}"
                onclick={() => handleClick(tab.id)}
            >
                {tab.label}
                {#if activeTab === tab.id}
                    <span
                        class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                    ></span>
                {/if}
            </button>
        {/if}
    {/each}
</div>
