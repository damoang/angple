<div class="space-y-3">
    {#each [0, 1, 2, 3] as i (i)}
        <div class="flex items-center gap-2 p-2">
            <div class="bg-muted h-8 w-12 animate-pulse rounded"></div>
            <div class="bg-muted h-4 flex-1 animate-pulse rounded"></div>
        </div>
    {/each}
</div>
