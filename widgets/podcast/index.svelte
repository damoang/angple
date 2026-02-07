<script lang="ts">
    /**
     * 팟캐스트 위젯
     * PodcastPlayer 컴포넌트가 이 위치에 렌더링됨
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import PlayCircle from '@lucide/svelte/icons/circle-play';

    let { config, slot, isEditMode = false }: WidgetProps = $props();
</script>

<div id="podcast-sidebar-anchor" class="border-border bg-background rounded-xl border p-4">
    {#if isEditMode}
        <div class="text-muted-foreground flex items-center justify-center py-4 text-sm">
            <PlayCircle class="mr-2 h-5 w-5" />
            팟캐스트 플레이어
        </div>
    {/if}
</div>
