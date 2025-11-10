<div class="space-y-3">
    {#each Array(4) as _}
        <div class="flex items-center gap-2 p-2">
            <div class="h-8 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 flex-1 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
        </div>
    {/each}
</div>
