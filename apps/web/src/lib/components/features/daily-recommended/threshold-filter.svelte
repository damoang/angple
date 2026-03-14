<script lang="ts">
    interface Props {
        threshold: number;
    }

    let { threshold = $bindable() }: Props = $props();

    const thresholds = [
        { value: 0, label: '전체' },
        { value: 3, label: '3+' },
        { value: 5, label: '5+' },
        { value: 10, label: '10+' },
        { value: 20, label: '20+' }
    ];
</script>

<div class="flex items-center gap-0.5">
    <span class="text-muted-foreground mr-1 hidden text-xs sm:inline">추천</span>
    {#each thresholds as t (t.value)}
        <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors
				{threshold === t.value
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => (threshold = t.value)}
        >
            {t.label}
        </button>
    {/each}
</div>
