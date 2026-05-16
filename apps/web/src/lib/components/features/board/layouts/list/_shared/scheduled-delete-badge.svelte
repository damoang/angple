<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';

    interface Props {
        scheduledDeleteAt?: string | null;
    }

    let { scheduledDeleteAt }: Props = $props();
</script>

{#if scheduledDeleteAt}
    <Badge
        variant="outline"
        class="shrink-0 border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        title={`삭제 예정: ${scheduledDeleteAt}`}>삭제예정</Badge
    >
{/if}
