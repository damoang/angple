<script lang="ts">
    import type { EconomyTabId } from '$lib/api/types.js';

    type Props = {
        activeTab: EconomyTabId;
        onTabChange: (tabId: EconomyTabId) => void;
    };

    let { activeTab = $bindable(), onTabChange }: Props = $props();

    const tabs: { id: EconomyTabId; label: string }[] = [
        { id: 'economy', label: '구매' },
        { id: 'qa', label: 'Q&A' },
        { id: 'free', label: '앙지도' },
        { id: 'angtt', label: '평점' }
    ];

    function handleTabClick(tabId: EconomyTabId) {
        activeTab = tabId;
        onTabChange(tabId);
    }
</script>

<div class="flex gap-1">
    {#each tabs as tab (tab.id)}
        <button
            type="button"
            class="rounded-md px-2.5 py-1 text-sm font-medium transition-all duration-200 ease-out
                {activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => handleTabClick(tab.id)}
        >
            {tab.label}
        </button>
    {/each}
</div>
