<script lang="ts">
    import type { EconomyTabId } from '$lib/api/types.js';

    type Props = {
        activeTab: EconomyTabId;
        onTabChange: (tabId: EconomyTabId) => void;
    };

    let { activeTab = $bindable(), onTabChange }: Props = $props();

    const tabs: { id: EconomyTabId; label: string }[] = [
        { id: 'economy', label: '알뜰구매' },
        { id: 'qa', label: '질문과답변' },
        { id: 'free', label: '앙지도' },
        { id: 'angtt', label: '다모앙 평점' }
    ];

    function handleTabClick(tabId: EconomyTabId) {
        activeTab = tabId;
        onTabChange(tabId);
    }
</script>

<ul class="flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist">
    {#each tabs as tab (tab.id)}
        <li role="presentation">
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                class="rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors
                    {activeTab === tab.id
                    ? 'border-primary text-foreground border-b-2'
                    : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => handleTabClick(tab.id)}
            >
                {tab.label}
            </button>
        </li>
    {/each}
</ul>
