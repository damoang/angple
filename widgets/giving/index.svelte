<script lang="ts">
    /**
     * 나눔 위젯 (사이드바 컴팩트)
     * 공지사항 위젯과 동일한 스타일로 진행중인 나눔 목록을 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';
    import { Gift } from '../lucide.js';
    import { timedFetch } from '$lib/utils/timed-fetch';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    interface GivingItem {
        id: number;
        title: string;
        giving_end?: string | null;
        participant_count?: number;
        is_urgent: boolean;
    }

    /**
     * 목록 개수. fetch 의 limit 과 로딩 스켈레톤 개수를 한 값으로 묶는다 —
     * 둘이 어긋나면 하이드레이션 직후 높이가 바뀌어 그대로 CLS 가 된다.
     */
    const GIVING_WIDGET_LIMIT = 5;

    let items = $state<GivingItem[]>([]);
    let loading = $state(true);
    let error = $state(false);

    // 카운트다운용 현재 시각
    let now = $state(Date.now());
    $effect(() => {
        const interval = setInterval(() => {
            now = Date.now();
        }, 1000);
        return () => clearInterval(interval);
    });

    onMount(async () => {
        try {
            // timedFetch: 12s timeout + 1회 retry. (audit 2026-05-01 §3-1)
            const res = await timedFetch(
                // tab=all: 진행중(임박순) 우선 + 최신 글 채움 — premium 포크와 동일 정책 (be#605 세트)
                `/api/plugins/giving/list?tab=all&limit=${GIVING_WIDGET_LIMIT}&sort=urgent`
            );
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    items = data.data || [];
                }
            } else {
                error = true;
            }
        } catch {
            error = true;
        } finally {
            loading = false;
        }
    });

    function formatCountdown(endTimeStr: string): string {
        const end = new Date(endTimeStr).getTime();
        const diff = end - now;
        if (diff <= 0) return '종료';
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        if (h >= 24) {
            const d = Math.floor(h / 24);
            return `${d}일`;
        }
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
</script>

<div class="border-border bg-background rounded-xl border p-4">
    <h3 class="text-foreground mb-3 flex items-center gap-1.5 text-sm font-semibold">
        <Gift class="h-4 w-4 text-emerald-500" />
        나눔
        <a
            href="/giving"
            class="text-muted-foreground ml-auto text-[10px] font-normal hover:underline"
            >전체보기</a
        >
    </h3>

    {#if loading}
        <!--
            스켈레톤은 실제 목록과 **같은 개수·같은 구조**여야 한다.
            onMount 는 SSR 에서 실행되지 않으므로 서버 HTML 에는 항상 이 블록이 나가고,
            하이드레이션 후 실제 목록으로 교체되며 그 높이 차이가 그대로 CLS 가 된다.
            개수는 위 fetch 의 limit(=5)과 맞춘다 — 바꾸면 여기도 같이 바꿔야 한다.
            (2026-08-12 실측: 3개짜리 스켈레톤이 데스크톱 CLS 0.066 의 주범이었다)
        -->
        <ul class="text-muted-foreground space-y-2 text-xs">
            {#each Array(GIVING_WIDGET_LIMIT) as _}
                <li class="flex items-center gap-1.5">
                    <span class="bg-muted h-4 min-w-0 flex-1 animate-pulse rounded"></span>
                    <span class="bg-muted h-4 w-12 shrink-0 animate-pulse rounded"></span>
                </li>
            {/each}
        </ul>
    {:else if error || items.length === 0}
        <!-- 빈 상태도 목록과 높이를 맞춰 축소 shift 를 막는다 -->
        <div
            class="text-muted-foreground flex items-center justify-center text-center text-xs"
            style="min-height: calc({GIVING_WIDGET_LIMIT} * 1rem + {GIVING_WIDGET_LIMIT -
                1} * 0.5rem)"
        >
            진행중인 나눔이 없어요
        </div>
    {:else}
        <!--
            ⛔ 실제 목록에도 스켈레톤과 **같은 최소 높이**를 준다.
            스켈레톤은 항상 GIVING_WIDGET_LIMIT개인데 실제 데이터는 그보다 적을 수 있다.
            2026-08-20 실측: 공지 스켈레톤 5개(112px) → 실제 4개(97px) 로 15px 줄며
            아래 위젯과 footer 가 통째로 밀렸다. 빈 상태에는 이미 이 방어가 있었는데
            **정작 목록에만 없었다.**
        -->
        <ul
            class="text-muted-foreground space-y-2 text-xs"
            style="min-height: calc({GIVING_WIDGET_LIMIT} * 1rem + {GIVING_WIDGET_LIMIT -
                1} * 0.5rem)"
        >
            {#each items as item (item.id)}
                <li class="flex items-center gap-1.5">
                    <a
                        href="/giving/{item.id}"
                        class="hover:text-primary min-w-0 flex-1 truncate transition-colors hover:underline"
                    >
                        • {item.title}
                    </a>
                    {#if item.giving_end}
                        <span
                            class="shrink-0 font-mono text-[10px] {item.is_urgent
                                ? 'font-semibold text-red-500'
                                : 'text-muted-foreground'}"
                        >
                            {formatCountdown(item.giving_end)}
                        </span>
                    {/if}
                </li>
            {/each}
        </ul>
    {/if}
</div>
