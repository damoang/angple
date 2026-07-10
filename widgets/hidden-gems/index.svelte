<script lang="ts">
    /**
     * 숨은 보석 — 자유게시판 편중 완화용 발견 위젯.
     * explore new 풀(24h 크로스보드)에서 대형 게시판을 제외한 글을
     * 방문마다 랜덤 로테이션으로 소개한다. (발견 엔진 1단, 계획 2026-07-10)
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import type { ExplorePost } from '$lib/api/types';
    import Gem from '@lucide/svelte/icons/gem';
    import { trackEvent } from '$lib/services/ga4.js';

    let { config, prefetchData }: WidgetProps = $props();

    const itemCount = $derived(
        Number((config?.settings as Record<string, unknown> | undefined)?.item_count ?? 4)
    );

    const pool = $derived(
        ((prefetchData as { posts?: ExplorePost[] })?.posts ?? []) as ExplorePost[]
    );

    // 방문(마운트)마다 다른 조합 — 서버 30초 캐시와 무관하게 클라에서 셔플
    let picks = $state<ExplorePost[]>([]);
    $effect(() => {
        const source = [...pool];
        for (let i = source.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [source[i], source[j]] = [source[j], source[i]];
        }
        picks = source.slice(0, itemCount);
    });

    function handleClick(post: ExplorePost): void {
        trackEvent('hidden_gem_click', {
            board: post.board,
            post_id: post.id
        });
    }
</script>

{#if picks.length > 0}
    <div class="bg-card rounded-lg border p-4">
        <div class="mb-3 flex items-center justify-between">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
                <Gem class="text-primary h-4 w-4" />
                이런 게시판도 있어요
            </h3>
            <a href="/explore" class="text-muted-foreground hover:text-primary text-xs">
                더 둘러보기
            </a>
        </div>
        <ul class="space-y-2">
            {#each picks as post (post.board + post.id)}
                <li class="min-w-0">
                    <a
                        href={`/${post.board}/${post.id}`}
                        class="group flex items-baseline gap-2"
                        onclick={() => handleClick(post)}
                    >
                        <span
                            class="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                        >
                            {post.board_name}
                        </span>
                        <span class="group-hover:text-primary truncate text-sm">
                            {post.title}
                        </span>
                        {#if post.comment_count > 0}
                            <span class="text-muted-foreground shrink-0 text-xs"
                                >{post.comment_count}</span
                            >
                        {/if}
                    </a>
                </li>
            {/each}
        </ul>
    </div>
{/if}
