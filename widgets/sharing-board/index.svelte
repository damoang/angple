<script lang="ts">
    /**
     * 나눔 게시판 위젯
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import Gift from '@lucide/svelte/icons/gift';

    let { config, slot, isEditMode = false }: WidgetProps = $props();
</script>

<div class="rounded-xl border border-border bg-background p-4">
    <h3 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Gift class="h-4 w-4 text-muted-foreground" />
        나눔 게시판
    </h3>
    <ul class="space-y-2 text-xs text-muted-foreground">
        <li class="cursor-pointer truncate transition-colors hover:text-primary">• [진행중] 연말 특별 나눔 이벤트</li>
        <li class="cursor-pointer truncate transition-colors hover:text-primary">• [마감] 기프티콘 나눔</li>
        <li class="cursor-pointer truncate transition-colors hover:text-primary">• [진행중] 책 나눔합니다</li>
    </ul>
</div>
