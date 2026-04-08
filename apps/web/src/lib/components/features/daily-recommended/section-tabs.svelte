<script lang="ts">
    interface Props {
        activeTab: 'all' | 'community' | 'group' | 'info';
        counts: { all: number; community: number; group: number; info: number };
    }

    let { activeTab = $bindable(), counts }: Props = $props();

    const tabs: { id: Props['activeTab']; label: string }[] = [
        { id: 'all', label: '전체' },
        { id: 'community', label: '커뮤니티' },
        { id: 'group', label: '소모임' },
        { id: 'info', label: '정보' }
    ];
</script>

<div class="flex gap-1 overflow-x-auto" style="-ms-overflow-style:none;scrollbar-width:none">
    {#each tabs as tab (tab.id)}
        <button
            type="button"
            class="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-200 ease-out sm:text-sm
				{activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => (activeTab = tab.id)}
        >
            {tab.label}
            <span class="ml-0.5 text-[10px] opacity-70">{counts[tab.id]}</span>
        </button>
    {/each}
</div>
