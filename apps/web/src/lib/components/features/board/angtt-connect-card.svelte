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
     * - 크라우드 제안(미연결 분기): 독자가 작품 연결을 제안, 서로 다른 회원 2명이면
     *   자동 승격. 감지(detect)는 클릭 시에만, 현황(status)은 마운트 후 지연 조회.
     */
    import { onMount } from 'svelte';
    import { trackEvent } from '$lib/services/ga4';
    import { toThumbnailUrl } from '$lib/utils/thumbnail-url.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { SUGGEST_MIN_LEVEL, buildSuggestStatusText } from './angtt-suggest-logic.js';
    import { shouldShowAverage } from './rating-display.js';

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
        postTitle = '',
        isAuthor = false
    }: {
        match: AngttCardMatch;
        boardId: string;
        postId: number | string;
        /** 글 제목 — 크라우드 제안의 작품 감지(/api/angtt/detect) 입력 */
        postTitle?: string;
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

    // ── 크라우드 제안 (notFound 분기 전용) ─────────────────────────────
    // 성능 규약: 감지(detect)는 사용자 클릭으로만 호출한다. 현황(status)은 카드
    // 마운트 후 지연 조회 — 글상세 SSR 은 어느 쪽도 조회하지 않는다.
    interface SuggestEntry {
        slug: string;
        title: string;
        count: number;
    }
    interface SuggestStatusData {
        suggestions: SuggestEntry[];
        myVotes: string[];
        linked: { slug: string; title: string } | null;
    }

    let suggestStatus = $state<SuggestStatusData | null>(null);
    let detectCandidate = $state<{ slug: string; title: string } | null>(null);
    let detectDone = $state(false);
    let suggestBusy = $state(false);
    let suggestError = $state('');

    /** 제안 가능 뷰어인가 — 별점과 동일 기준(앙님💛). 미달·비로그인은 상태만 본다. */
    const canSuggest = $derived(
        authStore.isAuthenticated && (authStore.user?.mb_level ?? 1) >= SUGGEST_MIN_LEVEL
    );

    async function loadSuggestStatus() {
        try {
            const res = await fetch(
                `/api/angtt/suggest/status?boardId=${encodeURIComponent(boardId)}&wrId=${encodeURIComponent(String(postId))}`
            );
            if (res.ok) suggestStatus = await res.json();
        } catch {
            // 현황 조회 실패는 제안 UI 만 생략 — 카드 본체에는 영향 없음
        }
    }

    /** [연결 제안] 클릭 → 글 제목으로 작품 감지 (클릭 시에만 detect 호출) */
    async function handleDetect() {
        if (suggestBusy) return;
        suggestBusy = true;
        suggestError = '';
        onCtaClick('suggest');
        try {
            const res = await fetch(`/api/angtt/detect?title=${encodeURIComponent(postTitle)}`);
            const data = res.ok ? await res.json() : { match: null };
            detectCandidate = data.match
                ? { slug: data.match.slug, title: data.match.title }
                : null;
        } catch {
            detectCandidate = null;
        } finally {
            detectDone = true;
            suggestBusy = false;
        }
    }

    async function submitSuggest(slug: string, title: string) {
        if (suggestBusy) return;
        suggestBusy = true;
        suggestError = '';
        try {
            const res = await fetch('/api/angtt/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId, wrId: Number(postId), slug })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                suggestError = data?.error ?? '제안에 실패했어요. 잠시 후 다시 시도해 주세요.';
                return;
            }
            detectCandidate = null;
            if (data.promoted) {
                // 승격은 서버가 확정한 사실 — 즉시 연결 표시로 전환
                suggestStatus = {
                    suggestions: [{ slug, title, count: data.count }],
                    myVotes: [slug],
                    linked: { slug, title }
                };
            } else {
                // 내 표 1건으로 통째 교체하면 같은 글의 다른 작품 제안 현황이
                // 새로고침까지 사라진다 — 서버 현황을 다시 읽는다.
                await loadSuggestStatus();
            }
        } catch {
            suggestError = '제안에 실패했어요. 잠시 후 다시 시도해 주세요.';
        } finally {
            suggestBusy = false;
        }
    }

    async function withdrawSuggest(slug: string, title: string) {
        if (suggestBusy) return;
        suggestBusy = true;
        suggestError = '';
        try {
            const res = await fetch('/api/angtt/suggest', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId, wrId: Number(postId), slug })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                suggestError = data?.error ?? '철회에 실패했어요. 잠시 후 다시 시도해 주세요.';
                return;
            }
            // 서버 현황 재조회 — 로컬 교체는 다른 작품 제안 현황을 지운다
            await loadSuggestStatus();
        } catch {
            suggestError = '철회에 실패했어요. 잠시 후 다시 시도해 주세요.';
        } finally {
            suggestBusy = false;
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
        // 미연결 카드만 제안 현황을 지연 조회한다 (SSR 무접촉)
        if ('notFound' in match) void loadSuggestStatus();
    });

    function onCtaClick(cta: 'rate' | 'register' | 'suggest'): void {
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
    <div class="bg-card my-4 rounded-lg border p-3">
        {#if 'notFound' in match}
            <div class="flex items-center gap-3">
                <div
                    class="bg-muted flex aspect-[2/3] w-11 shrink-0 items-center justify-center rounded text-lg"
                    aria-hidden="true"
                >
                    🎬
                </div>
                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">
                        「{match.query}」 — 앙티티에 아직 없어요
                    </p>
                    <p class="text-muted-foreground text-xs">다모앙 추천작 — 앙티티</p>
                </div>
                <a
                    href="/angtt"
                    class="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium"
                    onclick={() => onCtaClick('register')}
                >
                    ✍️ 첫 등록하고 별점 열기
                </a>
            </div>

            <!-- 크라우드 제안: 독자 2명이 같은 작품을 제안하면 자동 연결 (마운트 후 지연 조회) -->
            {#if suggestStatus?.linked}
                <p class="text-muted-foreground mt-2 border-t pt-2 text-xs">
                    앙님들의 제안으로
                    <a
                        class="hover:text-foreground underline underline-offset-2"
                        href={`/angtt/${encodeURIComponent(suggestStatus.linked.slug)}`}
                    >
                        「{suggestStatus.linked.title}」
                    </a>
                    에 연결됐어요.
                </p>
            {:else if suggestStatus && suggestStatus.suggestions.length > 0}
                <div class="mt-2 space-y-1 border-t pt-2">
                    {#each suggestStatus.suggestions as s (s.slug)}
                        <div class="flex items-center gap-2 text-xs">
                            <span class="text-muted-foreground min-w-0 flex-1 truncate">
                                「{s.title}」 {buildSuggestStatusText(s.count)}
                            </span>
                            {#if canSuggest}
                                {#if suggestStatus.myVotes.includes(s.slug)}
                                    <button
                                        type="button"
                                        class="text-muted-foreground hover:text-foreground shrink-0 underline underline-offset-2 disabled:opacity-50"
                                        onclick={() => withdrawSuggest(s.slug, s.title)}
                                        disabled={suggestBusy}
                                    >
                                        철회
                                    </button>
                                {:else}
                                    <button
                                        type="button"
                                        class="text-primary shrink-0 font-medium underline underline-offset-2 disabled:opacity-50"
                                        onclick={() => submitSuggest(s.slug, s.title)}
                                        disabled={suggestBusy}
                                    >
                                        나도 제안
                                    </button>
                                {/if}
                            {/if}
                        </div>
                    {/each}
                    {#if suggestError}
                        <p class="text-destructive text-xs">{suggestError}</p>
                    {/if}
                </div>
            {:else if suggestStatus && canSuggest}
                <div class="mt-2 border-t pt-2">
                    {#if detectCandidate}
                        <div class="flex items-center gap-2 text-xs">
                            <span class="text-muted-foreground min-w-0 flex-1 truncate">
                                제목에서 「{detectCandidate.title}」을(를) 찾았어요.
                            </span>
                            <button
                                type="button"
                                class="text-primary shrink-0 font-medium underline underline-offset-2 disabled:opacity-50"
                                onclick={() =>
                                    detectCandidate &&
                                    submitSuggest(detectCandidate.slug, detectCandidate.title)}
                                disabled={suggestBusy}
                            >
                                「{detectCandidate.title}」(으)로 연결 제안
                            </button>
                        </div>
                    {:else if detectDone}
                        <p class="text-muted-foreground text-xs">
                            제목에서 제안할 작품을 찾지 못했어요.
                        </p>
                    {:else}
                        <button
                            type="button"
                            class="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2 disabled:opacity-50"
                            onclick={handleDetect}
                            disabled={suggestBusy}
                        >
                            🔗 이 글의 작품 연결 제안
                        </button>
                    {/if}
                    {#if suggestError}
                        <p class="text-destructive mt-1 text-xs">{suggestError}</p>
                    {/if}
                </div>
            {/if}
        {:else}
            <div class="flex items-center gap-3">
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
                            <!-- n<3 착시 방지: 참여 3명 미만이면 평균 숫자 미노출(rating-display 규약) -->
                            <span class="text-amber-600 dark:text-amber-400">
                                {#if shouldShowAverage(match.rating.count)}
                                    · ★{match.rating.avg.toFixed(1)} · 앙님 {match.rating.count}명
                                {:else}
                                    · 앙님 {match.rating.count}명 평가
                                {/if}
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
            </div>
        {/if}
    </div>
{/if}
