<script lang="ts">
    /**
     * 공지사항 위젯
     * 자유게시판 상단 고정글(notices) + notice 게시판 최신글을 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import type { FreePost } from '$lib/api/types';
    import { apiClient } from '$lib/api';
    import { onMount } from 'svelte';
    import { Info, Eye } from '../lucide.js';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    let notices = $state<FreePost[]>([]);
    let latestNotice = $state<FreePost | null>(null);
    let loading = $state(true);
    let error = $state(false);

    // apiClient 는 자체 abort 를 노출하지 않으므로 Promise.race 타임가드로 skeleton 무한 대기 방지.
    // (audit 2026-05-01 §3-1)
    const FETCH_TIMEOUT_MS = 12_000;
    function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), ms);
            p.then(
                (v) => {
                    clearTimeout(timer);
                    resolve(v);
                },
                (e) => {
                    clearTimeout(timer);
                    reject(e);
                }
            );
        });
    }

    onMount(async () => {
        if (prefetchData) {
            notices = prefetchData as FreePost[];
            loading = false;
            return;
        }

        try {
            const [noticesData, latestData] = await withTimeout(
                Promise.all([
                    apiClient.getBoardNotices('free'),
                    apiClient.getBoardPosts('notice', 1, 1).catch(() => null)
                ]),
                FETCH_TIMEOUT_MS
            );
            notices = noticesData.slice(0, 5);
            if (latestData?.items?.length) {
                latestNotice = latestData.items[0];
            }
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
                <li class="flex items-center gap-1">
                    <a
                        href={`/free/${notice.id}`}
                        class="hover:text-primary min-w-0 flex-1 truncate transition-colors hover:underline"
                    >
                        • {notice.title}
                    </a>
                    <span
                        class="text-muted-foreground/60 flex shrink-0 items-center gap-0.5 text-[10px]"
                    >
                        <Eye class="h-3 w-3" />
                        {notice.views.toLocaleString()}
                    </span>
                </li>
            {/each}
            {#if latestNotice}
                <li class="border-border flex items-center gap-1 border-t pt-2">
                    <a
                        href={`/notice/${latestNotice.id}`}
                        class="hover:text-primary min-w-0 flex-1 truncate transition-colors hover:underline"
                    >
                        • {latestNotice.title}
                    </a>
                    <span
                        class="text-muted-foreground/60 flex shrink-0 items-center gap-0.5 text-[10px]"
                    >
                        <Eye class="h-3 w-3" />
                        {latestNotice.views.toLocaleString()}
                    </span>
                </li>
            {/if}
        </ul>
    {/if}
</div>
