<script lang="ts">
    /**
     * 공지사항 위젯
     * 자유게시판 상단 고정글(notices) + notice 게시판 최신글을 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import type { FreePost } from '$lib/api/types';
    import { apiClient } from '$lib/api';
    import { ApiRequestError } from '$lib/api/errors';
    import { onMount, onDestroy } from 'svelte';
    import { Info, Eye } from '../lucide.js';

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    let notices = $state<FreePost[]>([]);
    let latestNotice = $state<FreePost | null>(null);
    let loading = $state(true);
    let error = $state(false);

    // P0 leak fix (2026-05-02): Promise.race(timeout, apiClient.x) 패턴은
    // timeout reject 후에도 underlying fetch closure 가 살아남아 SSR/CSR 양쪽에서
    // ~50 MiB/h 누적. apiClient 가 이제 AbortSignal 을 받으므로
    // AbortController 로 timeout + unmount 통합 abort.
    const FETCH_TIMEOUT_MS = 12_000;
    let controller: AbortController | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    onMount(async () => {
        if (prefetchData) {
            notices = prefetchData as FreePost[];
            loading = false;
            return;
        }

        controller = new AbortController();
        const signal = controller.signal;
        timeoutId = setTimeout(() => controller?.abort(), FETCH_TIMEOUT_MS);

        try {
            const [noticesData, latestData] = await Promise.all([
                apiClient.getBoardNotices('free', { signal }),
                apiClient.getBoardPosts('notice', 1, 1, { signal }).catch((e) => {
                    // abort 는 위로 전파, 그 외는 silently null
                    if (e instanceof ApiRequestError && e.type === 'aborted') throw e;
                    return null;
                })
            ]);
            notices = noticesData.slice(0, 5);
            if (latestData?.items?.length) {
                latestNotice = latestData.items[0];
            }
        } catch (e) {
            // unmount 로 인한 abort 면 state 업데이트 무의미
            if (e instanceof ApiRequestError && e.type === 'aborted') return;
            error = true;
        } finally {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            loading = false;
        }
    });

    onDestroy(() => {
        // unmount 시 in-flight fetch 즉시 정리 → closure leak 방지
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        controller?.abort();
        controller = null;
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
