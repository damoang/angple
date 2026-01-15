<script lang="ts">
    import type { NewsTabId } from '$lib/api/types.js';

    type Props = {
        activeTab: NewsTabId;
        onTabChange: (tabId: NewsTabId) => void;
    };

    let { activeTab = $bindable(), onTabChange }: Props = $props();

    const tabs: { id: NewsTabId; label: string }[] = [
        { id: 'new', label: '소식' },
        { id: 'tip', label: '정보' },
        { id: 'review', label: '사용기' },
        { id: 'notice', label: '공지' }
    ];

    function handleTabClick(tabId: NewsTabId) {
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
