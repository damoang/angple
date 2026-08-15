<script lang="ts">
    /**
     * 지금 뜨는 소모임 — 최근 활동이 활발한 소모임을 소개하는 발견 위젯.
     * 소수 인기 소모임에 쏠린 활동을 롱테일 소모임으로 분산시키기 위한 노출 레버.
     *
     * 자체 fetch(/api/groups/trending) — SSR prefetch 불필요 → 홈 SSR 경로 무변경(회귀 0).
     * 활동 0(빈 결과)이면 아무것도 렌더하지 않는다(hidden-gems·emoji-awards 와 동일 패턴).
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';
    import Flame from '@lucide/svelte/icons/flame';
    import { timedFetch } from '$lib/utils/timed-fetch';
    import { trackEvent } from '$lib/services/ga4.js';

    let { config }: WidgetProps = $props();

    interface TrendingGroupItem {
        bo_table: string;
        board_path: string;
        bo_subject: string;
        weekly_count: number;
        today_count: number;
        latest_wr_id: number | null;
        latest_subject: string | null;
    }

    const itemCount = $derived(
        Math.min(
            5,
            Math.max(
                3,
                Number((config?.settings as Record<string, unknown> | undefined)?.item_count ?? 5)
            )
        )
    );

    let items = $state<TrendingGroupItem[]>([]);
    /**
     * 첫 렌더에서 자리를 예약하기 위한 상태.
     *
     * onMount 는 SSR 에서 실행되지 않으므로 서버 HTML 에는 이 위젯이 통째로 빠져 있었고,
     * 데이터가 도착하는 순간 286px 가 한꺼번에 생겨 아래 위젯·광고를 전부 밀어냈다
     * (2026-08-15 실측: 데스크톱 CLS 0.077 의 최대 기여자).
     * 로딩 동안 같은 높이의 스켈레톤을 그려 그 이동을 없앤다.
     */
    let loading = $state(true);

    onMount(async () => {
        try {
            const res = await timedFetch(`/api/groups/trending?limit=${itemCount}`);
            if (res.ok) {
                const data = await res.json();
                items = ((data.items ?? []) as TrendingGroupItem[]).slice(0, itemCount);
            }
        } catch {
            // 무해 실패 — 위젯 미표시
        } finally {
            loading = false;
        }
    });

    function handleGroupClick(item: TrendingGroupItem): void {
        trackEvent('trending_group_click', { board: item.bo_table, target: 'group' });
    }

    function handlePostClick(item: TrendingGroupItem): void {
        trackEvent('trending_group_click', { board: item.bo_table, target: 'post' });
    }
</script>

{#if loading}
    <!--
        실제 항목과 같은 골격(제목 20px + 최신글 16px)으로 itemCount 개를 그려 높이를 맞춘다.
        ⛔ 개수를 하드코딩하지 말 것 — fetch limit 과 어긋나면 그만큼이 다시 shift 가 된다.
        데이터가 0건이면 아래 분기에서 통째로 접힌다("활동 0이면 미표시" 정책 유지).
    -->
    <div class="bg-card rounded-lg border p-4" aria-hidden="true">
        <div class="mb-3 flex items-center justify-between">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
                <Flame class="h-4 w-4 text-orange-500" />
                지금 뜨는 소모임
            </h3>
        </div>
        <ul class="space-y-2.5">
            {#each Array(itemCount) as _}
                <li class="min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="bg-muted h-5 min-w-0 flex-1 animate-pulse rounded"></span>
                        <span class="bg-muted h-5 w-8 shrink-0 animate-pulse rounded"></span>
                    </div>
                    <span class="bg-muted block h-4 w-3/4 animate-pulse rounded"></span>
                </li>
            {/each}
        </ul>
    </div>
{:else if items.length > 0}
    <div class="bg-card rounded-lg border p-4">
        <div class="mb-3 flex items-center justify-between">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
                <Flame class="h-4 w-4 text-orange-500" />
                지금 뜨는 소모임
            </h3>
            <a href="/groups" class="text-muted-foreground hover:text-primary text-xs">전체보기</a>
        </div>
        <ul class="space-y-2.5">
            {#each items as item (item.bo_table)}
                <li class="min-w-0">
                    <div class="flex items-center gap-2">
                        <a
                            href={`/${item.board_path}`}
                            class="hover:text-primary truncate text-sm font-medium"
                            onclick={() => handleGroupClick(item)}
                        >
                            {item.bo_subject}
                        </a>
                        <span class="text-muted-foreground shrink-0 text-xs">
                            주 {item.weekly_count}
                        </span>
                    </div>
                    {#if item.latest_subject && item.latest_wr_id}
                        <a
                            href={`/${item.board_path}/${item.latest_wr_id}`}
                            class="text-muted-foreground hover:text-primary block truncate text-xs"
                            onclick={() => handlePostClick(item)}
                        >
                            {item.latest_subject}
                        </a>
                    {/if}
                </li>
            {/each}
        </ul>
    </div>
{/if}
