<script lang="ts">
    import type { GroupTabId } from '$lib/api/types.js';

    type Props = {
        activeTab: GroupTabId;
        onTabChange: (tabId: GroupTabId) => void;
    };

    let { activeTab = $bindable(), onTabChange }: Props = $props();

    const tabs: { id: GroupTabId; label: string }[] = [
        { id: 'all', label: '전체글' },
        { id: '24h', label: '24시간' },
        { id: 'week', label: '주간' },
        { id: 'month', label: '이번 달' }
    ];

    function handleTabClick(tabId: GroupTabId) {
        activeTab = tabId;
        onTabChange(tabId);
    }
</script>

<ul class="flex flex-1 gap-1" role="tablist">
    {#each tabs as tab (tab.id)}
        <li role="presentation">
            <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                    {activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                onclick={() => handleTabClick(tab.id)}
            >
                {tab.label}
            </button>
        </li>
    {/each}
</ul>
