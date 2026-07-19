<script lang="ts">
    /**
     * 앙티티 커넥트 카드 (Phase 1)
     *
     * 규약: 글 태그에 「앙티티」 + 작품명 → 글 하단(댓글 직전)에 작품 카드.
     * 서버(+page.server.ts)에서 사전 매칭·별점을 확정해 SSR 렌더한다 (내부링크 SEO).
     *
     * - 매칭: 포스터(2:3 소형) + 작품명 + ★평점 + [⭐ 별점 주러 가기] → /angtt/{wrId}
     * - 미등록: 등록 유도 + [✍️ 첫 등록하고 별점 열기] → /angtt
     *   (글쓰기 라우트에 제목 프리필 쿼리 미지원 — Phase 2 에서 프리필 연동)
     * - 스포일러 안전: 포스터·평점·링크만 노출 (줄거리류 텍스트 없음)
     * - GA4: 카드 노출(angtt_card_impression) / CTA 클릭(angtt_card_cta_click)
     */
    import { onMount } from 'svelte';
    import { trackEvent } from '$lib/services/ga4';
    import { toThumbnailUrl } from '$lib/utils/thumbnail-url.js';

    /** 서버 AngttMatch(lib/server/angtt-dictionary.ts)와 구조 동일 — $lib/server 는 클라 import 불가라 별도 선언 */
    type AngttCardMatch =
        | {
              wrId: number;
              title: string;
              thumbnail: string;
              rating: { avg: number; count: number } | null;
          }
        | { notFound: true; query: string };

    let {
        match,
        boardId,
        postId
    }: {
        match: AngttCardMatch;
        boardId: string;
        postId: number | string;
    } = $props();

    const matched = $derived(!('notFound' in match));
    const posterUrl = $derived('notFound' in match ? '' : toThumbnailUrl(match.thumbnail));

    onMount(() => {
        trackEvent('angtt_card_impression', {
            board_id: boardId,
            post_id: String(postId),
            matched: matched ? 'yes' : 'no',
            work_id: 'notFound' in match ? '' : String(match.wrId)
        });
    });

    function onCtaClick(cta: 'rate' | 'register'): void {
        trackEvent('angtt_card_cta_click', {
            board_id: boardId,
            post_id: String(postId),
            cta,
            work_id: 'notFound' in match ? '' : String(match.wrId)
        });
    }
</script>

<div class="bg-card my-4 flex items-center gap-3 rounded-lg border p-3">
    {#if 'notFound' in match}
        <div
            class="bg-muted flex aspect-[2/3] w-11 shrink-0 items-center justify-center rounded text-lg"
            aria-hidden="true"
        >
            🎬
        </div>
        <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">「{match.query}」 — 앙티티에 아직 없어요</p>
            <p class="text-muted-foreground text-xs">다모앙 추천작 — 앙티티</p>
        </div>
        <a
            href="/angtt"
            class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium"
            onclick={() => onCtaClick('register')}
        >
            ✍️ 첫 등록하고 별점 열기
        </a>
    {:else}
        {#if posterUrl}
            <img
                src={posterUrl}
                alt="{match.title} 포스터"
                class="aspect-[2/3] w-11 shrink-0 rounded object-cover"
                loading="lazy"
            />
        {:else}
            <div
                class="bg-muted flex aspect-[2/3] w-11 shrink-0 items-center justify-center rounded text-lg"
                aria-hidden="true"
            >
                🎬
            </div>
        {/if}
        <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{match.title}</p>
            <p class="text-muted-foreground text-xs">
                다모앙 추천작 — 앙티티
                {#if match.rating && match.rating.count > 0}
                    <span class="text-amber-600 dark:text-amber-400">
                        · ★{match.rating.avg.toFixed(1)} · 앙님 {match.rating.count}명
                    </span>
                {:else if match.rating}
                    <span>· 아직 별점이 없어요</span>
                {/if}
            </p>
        </div>
        <a
            href="/angtt/{match.wrId}"
            class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium"
            onclick={() => onCtaClick('rate')}
        >
            ⭐ 별점 주러 가기
        </a>
    {/if}
</div>
