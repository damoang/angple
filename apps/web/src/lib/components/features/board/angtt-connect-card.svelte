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
              /** 작품 페이지 슬러그 — 있으면 /angtt/{slug}, 없으면 /angtt/{wrId} 폴백 */
              entitySlug?: string;
              /** 시스템이 자동 연결한 글인지 — 작성자에게 해제 버튼을 노출한다 */
              autoLinked?: boolean;
          }
        | { notFound: true; query: string };

    let {
        match,
        boardId,
        postId,
        isAuthor = false
    }: {
        match: AngttCardMatch;
        boardId: string;
        postId: number | string;
        /** 뷰어가 이 글의 작성자인지 — 자동 연결 해제 권한 */
        isAuthor?: boolean;
    } = $props();

    // 자동 연결 해제 — 시스템이 붙인 태그를 작성자가 되돌릴 수 있어야 한다.
    // 조용히 붙이지 않는 것이 원칙이고, 여기서 나온 해제 신호가 자동 부착 킬 스위치의 입력이 된다.
    let unlinking = $state(false);
    let unlinked = $state(false);

    async function handleUnlink() {
        if (unlinking) return;
        unlinking = true;
        try {
            const res = await fetch('/api/angtt/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId, wrId: Number(postId) })
            });
            if (res.ok) unlinked = true;
        } finally {
            unlinking = false;
        }
    }

    const matched = $derived(!('notFound' in match));
    const posterUrl = $derived('notFound' in match ? '' : toThumbnailUrl(match.thumbnail));
    // 매칭 카드 CTA 링크: 작품 엔티티가 있으면 작품 페이지, 없으면 기존 angtt 글로 폴백.
    const rateHref = $derived(
        'notFound' in match
            ? ''
            : match.entitySlug
              ? `/angtt/${encodeURIComponent(match.entitySlug)}`
              : `/angtt/${match.wrId}`
    );

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

{#if unlinked}
    <p class="text-muted-foreground my-4 text-xs">작품 연결을 해제했어요.</p>
{:else}
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
                <!--
                3번째 줄 — 포스터(66px)가 카드 높이를 정하고 텍스트는 2줄(36px)뿐이라
                이 줄을 넣어도 카드 크기는 변하지 않는다.
            -->
                {#if !('notFound' in match) && match.autoLinked}
                    <p class="text-muted-foreground/80 mt-0.5 truncate text-[11px]">
                        자동으로 연결되었어요{#if isAuthor}
                            <button
                                type="button"
                                class="hover:text-foreground ml-1 underline underline-offset-2 disabled:opacity-50"
                                onclick={handleUnlink}
                                disabled={unlinking}
                            >
                                {unlinking ? '해제 중…' : '해제'}
                            </button>
                        {/if}
                    </p>
                {/if}
            </div>
            <a
                href={rateHref}
                class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium"
                onclick={() => onCtaClick('rate')}
            >
                ⭐ 별점 주러 가기
            </a>
        {/if}
    </div>
{/if}
