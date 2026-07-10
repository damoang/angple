<script lang="ts">
    /**
     * 오늘의 앙모지 — 24h 리액션 리더보드 (발견 엔진 1단-A, 계획 2026-07-10).
     * Go recommend-system 이 5분마다 집계한 emoji_awards 를 표시한다.
     * (이용제한·삭제·비밀 글은 수집 단계에서 제외됨 — 정책 매트릭스 준수)
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import type { EmojiAwardPost } from '$lib/api/types';
    import Trophy from '@lucide/svelte/icons/trophy';
    import { getReactionDisplay } from '$lib/types/reaction.js';
    import { trackEvent } from '$lib/services/ga4.js';

    let { config, prefetchData }: WidgetProps = $props();

    const itemCount = $derived(
        Number((config?.settings as Record<string, unknown> | undefined)?.item_count ?? 5)
    );

    const entries = $derived(
        (
            ((prefetchData as { entries?: EmojiAwardPost[] })?.entries ?? []) as EmojiAwardPost[]
        ).slice(0, itemCount)
    );

    function handleClick(entry: EmojiAwardPost): void {
        trackEvent('emoji_award_click', {
            board: entry.board,
            post_id: entry.id
        });
    }
</script>

{#if entries.length > 0}
    <div class="bg-card rounded-lg border p-4">
        <div class="mb-3 flex items-center justify-between">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
                <Trophy class="h-4 w-4 text-amber-500" />
                오늘의 앙모지
            </h3>
            <span class="text-muted-foreground text-xs">최근 24시간</span>
        </div>
        <ol class="space-y-2">
            {#each entries as entry, i (entry.board + entry.id)}
                {@const display = getReactionDisplay(entry.top_reaction)}
                <li class="min-w-0">
                    <a
                        href={entry.url}
                        class="group flex items-center gap-2"
                        onclick={() => handleClick(entry)}
                    >
                        <span class="text-muted-foreground w-4 shrink-0 text-center text-xs">
                            {i + 1}
                        </span>
                        {#if display.renderType === 'image' && display.url}
                            <img
                                src={display.url}
                                alt={display.label}
                                class="h-5 w-5 shrink-0 object-scale-down"
                            />
                        {:else}
                            <span class="shrink-0 text-base leading-none">{display.emoji}</span>
                        {/if}
                        <span class="group-hover:text-primary truncate text-sm">
                            {entry.title}
                        </span>
                        <span class="text-muted-foreground shrink-0 text-xs">
                            {entry.reaction_total}
                        </span>
                    </a>
                </li>
            {/each}
        </ol>
    </div>
{/if}
