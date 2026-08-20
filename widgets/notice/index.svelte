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

    /**
     * 표시 개수. 목록 slice 와 로딩 스켈레톤 개수를 한 값으로 묶는다 —
     * 둘이 어긋나면 하이드레이션 직후 높이가 바뀌어 그대로 CLS 가 된다.
     */
    const NOTICE_WIDGET_LIMIT = 5;
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
            notices = noticesData.slice(0, NOTICE_WIDGET_LIMIT);
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
        <!--
            스켈레톤 개수는 실제 목록(slice 0..NOTICE_WIDGET_LIMIT)과 맞춰야 한다.
            onMount 는 SSR 에서 실행되지 않아 서버 HTML 에는 항상 이 블록이 나가고,
            하이드레이션 후 실제 목록으로 교체되며 높이 차이가 그대로 CLS 가 된다.
        -->
        <ul class="text-muted-foreground space-y-2 text-xs">
            {#each Array(NOTICE_WIDGET_LIMIT) as _}
                <li class="flex items-center gap-1">
                    <span class="bg-muted h-4 min-w-0 flex-1 animate-pulse rounded"></span>
                </li>
            {/each}
        </ul>
    {:else if error || notices.length === 0}
        <!-- 빈 상태도 목록과 높이를 맞춰 축소 shift 를 막는다 -->
        <div
            class="text-muted-foreground flex items-center justify-center text-center text-xs"
            style="min-height: calc({NOTICE_WIDGET_LIMIT} * 1rem + {NOTICE_WIDGET_LIMIT -
                1} * 0.5rem)"
        >
            아직 공지사항이 없어요
        </div>
    {:else}
        <!--
            ⛔ 실제 목록에도 스켈레톤과 **같은 최소 높이**를 준다.
            스켈레톤은 항상 NOTICE_WIDGET_LIMIT개인데 실제 데이터는 그보다 적을 수 있다.
            2026-08-20 실측: 공지 스켈레톤 5개(112px) → 실제 4개(97px) 로 15px 줄며
            아래 위젯과 footer 가 통째로 밀렸다. 빈 상태에는 이미 이 방어가 있었는데
            **정작 목록에만 없었다.**
        -->
        <ul
            class="text-muted-foreground space-y-2 text-xs"
            style="min-height: calc({NOTICE_WIDGET_LIMIT} * 1rem + {NOTICE_WIDGET_LIMIT -
                1} * 0.5rem)"
        >
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
