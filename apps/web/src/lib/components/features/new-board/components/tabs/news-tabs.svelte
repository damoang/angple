<script lang="ts">
    import type { NewsTabId } from '$lib/api/types.js';

    type Props = {
        activeTab: NewsTabId;
        onTabChange: (tabId: NewsTabId) => void;
    };

    let { activeTab = $bindable(), onTabChange }: Props = $props();

    const tabs: { id: NewsTabId; label: string }[] = [
        { id: 'new', label: '새로운 소식' },
        { id: 'tip', label: '정보와 자료' },
        { id: 'review', label: '사용기' },
        { id: 'notice', label: '공지사항' }
    ];

    function handleTabClick(tabId: NewsTabId) {
        activeTab = tabId;
        onTabChange(tabId);
    }
</script>

<ul class="flex gap-1" role="tablist">
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
