<script lang="ts">
    /**
     * 나눔 게시판 위젯
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import Gift from '@lucide/svelte/icons/gift';

    let { config, slot, isEditMode = false }: WidgetProps = $props();
</script>

<div class="border-border bg-background rounded-xl border p-4">
    <h3 class="text-foreground mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Gift class="text-muted-foreground h-4 w-4" />
        나눔 게시판
    </h3>
    <ul class="text-muted-foreground space-y-2 text-xs">
        <li class="hover:text-primary cursor-pointer truncate transition-colors">
            • [진행중] 연말 특별 나눔 이벤트
        </li>
        <li class="hover:text-primary cursor-pointer truncate transition-colors">
            • [마감] 기프티콘 나눔
        </li>
        <li class="hover:text-primary cursor-pointer truncate transition-colors">
            • [진행중] 책 나눔합니다
        </li>
    </ul>
</div>
