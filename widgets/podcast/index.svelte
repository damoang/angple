<script lang="ts">
    /**
     * 팟캐스트 위젯
     * PodcastPlayer 컴포넌트의 사이드바 앵커 역할
     */
    import type { WidgetProps } from '$lib/types/widget-props';

    let { config, slot, isEditMode = false }: WidgetProps = $props();
</script>

<div
    id="podcast-sidebar-anchor"
    class="border-border bg-background rounded-xl border p-4"
    class:ring-2={isEditMode}
    class:ring-blue-500={isEditMode}
>
    {#if isEditMode}
        <div class="text-muted-foreground flex items-center justify-center py-4 text-sm">
            <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
            </svg>
            팟캐스트 플레이어
        </div>
    {/if}
</div>
