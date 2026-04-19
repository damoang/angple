<script lang="ts">
    import type { EconomyTabId } from '$lib/api/types.js';

    type Props = {
        activeTab: EconomyTabId;
        onTabChange: (tabId: EconomyTabId) => void;
    };

    let { activeTab = $bindable(), onTabChange }: Props = $props();

    const tabs: { id: EconomyTabId; label: string }[] = [
        { id: 'economy', label: '알뜰' },
        { id: 'giving', label: '나눔' },
        { id: 'trade', label: '장터' },
        { id: 'review', label: '사용기' }
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
            class="rounded-md px-2.5 py-1 text-[15px] font-medium transition-all duration-200 ease-out
                {activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => handleTabClick(tab.id)}
        >
            {tab.label}
        </button>
    {/each}
</div>
