<script lang="ts">
    /**
     * 공지사항 위젯
     * 실제 notice 게시판 데이터를 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    interface Notice {
        id: number;
        title: string;
        url: string;
    }

    let notices = $state<Notice[]>([]);
    let loading = $state(true);
    let error = $state(false);

    onMount(async () => {
        if (prefetchData) {
            notices = prefetchData as Notice[];
            loading = false;
            return;
        }

        try {
            const res = await fetch('/api/v1/boards/notice/posts?per_page=5');
            if (res.ok) {
                const data = await res.json();
                const list = data.data?.list ?? data.data ?? [];
                notices = list.map((p: { wr_id: number; wr_subject: string }) => ({
                    id: p.wr_id,
                    title: p.wr_subject,
                    url: `/notice/${p.wr_id}`
                }));
            } else {
                error = true;
            }
        } catch (e) {
            error = true;
        } finally {
            loading = false;
        }
    });
</script>

<div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
>
    <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <svg class="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
        공지사항
    </h3>

    {#if loading}
        <ul class="space-y-2">
            {#each Array(3) as _}
                <li class="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></li>
            {/each}
        </ul>
    {:else if error || notices.length === 0}
        <p class="text-xs text-slate-400 dark:text-slate-500">공지사항이 없습니다.</p>
    {:else}
        <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            {#each notices as notice (notice.id)}
                <li class="truncate">
                    <a
                        href={notice.url}
                        class="hover:text-blue-600 hover:underline dark:hover:text-blue-400"
                    >
                        • {notice.title}
                    </a>
                </li>
            {/each}
        </ul>
    {/if}
</div>
