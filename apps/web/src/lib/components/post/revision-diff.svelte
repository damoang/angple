<script lang="ts">
    /**
     * 두 텍스트 간 줄 단위 diff 비교 뷰
     */
    interface Props {
        oldText: string;
        newText: string;
        oldLabel?: string;
        newLabel?: string;
    }

    let { oldText, newText, oldLabel = '이전', newLabel = '현재' }: Props = $props();

    interface DiffLine {
        type: 'added' | 'removed' | 'unchanged';
        text: string;
    }

    const diffLines = $derived.by(() => {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        const result: DiffLine[] = [];

        const maxLen = Math.max(oldLines.length, newLines.length);
        // 간단한 줄 단위 비교 (LCS 기반은 아님)
        const oldSet = new Set(oldLines);
        const newSet = new Set(newLines);

        for (const line of oldLines) {
            if (!newSet.has(line)) {
                result.push({ type: 'removed', text: line });
            }
        }
        for (const line of newLines) {
            if (!oldSet.has(line)) {
                result.push({ type: 'added', text: line });
            } else {
                result.push({ type: 'unchanged', text: line });
            }
        }

        return result;
    });

    const hasChanges = $derived(diffLines.some((l) => l.type !== 'unchanged'));
</script>

{#if !hasChanges}
    <p class="text-muted-foreground text-sm italic">변경 사항이 없습니다.</p>
{:else}
    <div class="overflow-hidden rounded-md border dark:border-neutral-700">
        <div class="bg-muted flex text-xs font-medium">
            <span class="flex-1 px-3 py-1.5 text-red-600 dark:text-red-400">- {oldLabel}</span>
            <span class="flex-1 px-3 py-1.5 text-green-600 dark:text-green-400">+ {newLabel}</span>
        </div>
        <div class="max-h-80 overflow-y-auto text-xs">
            {#each diffLines as line}
                {#if line.type === 'removed'}
                    <div
                        class="bg-red-50 px-3 py-0.5 text-red-800 dark:bg-red-950/30 dark:text-red-300"
                    >
                        <span class="mr-2 select-none opacity-50">-</span>{line.text || ' '}
                    </div>
                {:else if line.type === 'added'}
                    <div
                        class="bg-green-50 px-3 py-0.5 text-green-800 dark:bg-green-950/30 dark:text-green-300"
                    >
                        <span class="mr-2 select-none opacity-50">+</span>{line.text || ' '}
                    </div>
                {:else}
                    <div class="px-3 py-0.5 text-neutral-600 dark:text-neutral-400">
                        <span class="mr-2 select-none opacity-30">&nbsp;</span>{line.text || ' '}
                    </div>
                {/if}
            {/each}
        </div>
    </div>
{/if}
