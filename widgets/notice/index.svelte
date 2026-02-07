<script lang="ts">
    /**
     * 공지사항 위젯
     * 자유게시판 상단 고정글(notices)을 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import type { FreePost } from '$lib/api/types';
    import { apiClient } from '$lib/api';
    import { onMount } from 'svelte';
    import Info from '@lucide/svelte/icons/info';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    let notices = $state<FreePost[]>([]);
    let loading = $state(true);
    let error = $state(false);

    onMount(async () => {
        if (prefetchData) {
            notices = prefetchData as FreePost[];
            loading = false;
            return;
        }

        try {
            const data = await apiClient.getBoardNotices('free');
            notices = data.slice(0, 5);
        } catch (e) {
            error = true;
        } finally {
            loading = false;
        }
    });
</script>

<div class="border-border bg-background rounded-xl border p-4">
    <h3 class="text-foreground mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Info class="text-muted-foreground h-4 w-4" />
        공지사항
    </h3>

    {#if loading}
        <ul class="space-y-2">
            {#each Array(3) as _}
                <li class="bg-muted h-4 animate-pulse rounded"></li>
            {/each}
        </ul>
    {:else if error || notices.length === 0}
        <p class="text-muted-foreground py-2 text-center text-xs">아직 공지사항이 없어요</p>
    {:else}
        <ul class="text-muted-foreground space-y-2 text-xs">
            {#each notices as notice (notice.id)}
                <li class="truncate">
                    <a
                        href={`/free/${notice.id}`}
                        class="hover:text-primary transition-colors hover:underline"
                    >
                        • {notice.title}
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</div>
