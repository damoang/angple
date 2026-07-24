<script lang="ts">
    /**
     * 게시글 별점 위젯 (앙티티 Phase 0 — features.rating 보드)
     *
     * post.rating 이 글 상세 응답에 동봉된 게시글에서만 렌더된다
     * (부모에서 {#if post.rating} 가드 — 프론트에 별도 보드 설정 조회 없음).
     *
     * - 평균 별점 채움(부분 채움 포함) + "★4.3 · 앙님 21명" 요약
     * - 로그인 + 앙님💛(mb_level 3) 이상: 별 클릭으로 투표 (PUT, 낙관적 갱신 + 실패 롤백)
     * - 내 별점은 채움색(primary)으로 구분
     * - 레벨 미달 클릭: 기존 등급 안내 문구(buildGradeDeniedMessage) 재사용
     *
     * 계약: GET/PUT /api/v1/boards/:slug/posts/:id/rating → {avg, count, my}
     */
    import Star from '@lucide/svelte/icons/star';
    import { toast } from 'svelte-sonner';
    import { apiClient } from '$lib/api/client.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { buildGradeDeniedMessage } from '$lib/utils/board-permissions.js';
    import type { PostRating } from '$lib/api/types.js';
    import {
        RATING_MIN_LEVEL,
        applyOptimisticRating,
        starFillPercent
    } from './post-rating-logic.js';
    import { shouldShowAverage, type AspectRating } from './rating-display.js';
    import { getBoardAspectPreset } from '$plugins/angtt-review/lib/aspect-presets';
    import RatingAspects from './rating-aspects.svelte';

    let {
        boardId,
        postId,
        initial,
        aspects
    }: {
        boardId: string;
        postId: number | string;
        initial: PostRating;
        /** 항목별 평점 집계(SSR 주입). 프리셋 매핑 보드(앙지도 등)에서만 전달됨. */
        aspects?: AspectRating[];
    } = $props();

    /** 이 게시판의 항목별 프리셋(맛/가성비 등). 없으면 항목별 UI 미표시. */
    const aspectPreset = $derived(getBoardAspectPreset(boardId));

    const STARS = [1, 2, 3, 4, 5];

    // 의도적 초기값 스냅샷: SSR 동봉 집계를 시작점으로 쓰고 이후엔 위젯이 소유
    // svelte-ignore state_referenced_locally
    let rating = $state<PostRating>({ ...initial });
    let submitting = $state(false);
    let hoverValue = $state(0);

    const canVote = $derived(
        authStore.isAuthenticated && (authStore.user?.mb_level ?? 1) >= RATING_MIN_LEVEL
    );

    // 호버 미리보기 중이면 호버 값, 아니면 평균 채움
    const displayValue = $derived(hoverValue > 0 ? hoverValue : rating.avg);

    /** 내 별점 채움색 구분: 미리보기 중이 아닐 때, 내가 준 별까지 primary 색 */
    function isMyFill(star: number): boolean {
        return hoverValue === 0 && rating.my > 0 && star <= rating.my;
    }

    async function vote(star: number): Promise<void> {
        if (submitting) return;
        if (!authStore.isAuthenticated) {
            toast.error('별점을 남기려면 로그인이 필요해요.');
            return;
        }
        const level = authStore.user?.mb_level ?? 1;
        if (level < RATING_MIN_LEVEL) {
            toast.error(buildGradeDeniedMessage('별점 남기기', RATING_MIN_LEVEL, level));
            return;
        }

        const prev = { ...rating };
        rating = applyOptimisticRating(prev, star); // 낙관적 갱신
        hoverValue = 0;
        submitting = true;
        try {
            rating = await apiClient.putPostRating(boardId, postId, star);
            toast.success(prev.my > 0 ? '별점을 수정했어요.' : '별점을 남겼어요.');
        } catch (err) {
            rating = prev; // 실패 롤백
            toast.error(err instanceof Error ? err.message : '별점 등록에 실패했어요.');
        } finally {
            submitting = false;
        }
    }
</script>

<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
    <div class="flex items-center" role="radiogroup" aria-label="별점 선택 (1~5점)">
        {#each STARS as star (star)}
            <button
                type="button"
                class="p-0.5 transition-transform {canVote
                    ? 'cursor-pointer hover:scale-110'
                    : 'cursor-default'}"
                disabled={submitting}
                role="radio"
                aria-checked={rating.my === star}
                aria-label="별점 {star}점"
                onclick={() => vote(star)}
                onmouseenter={() => {
                    if (canVote) hoverValue = star;
                }}
                onmouseleave={() => (hoverValue = 0)}
                onfocus={() => {
                    if (canVote) hoverValue = star;
                }}
                onblur={() => (hoverValue = 0)}
            >
                <span class="relative block h-5 w-5">
                    <Star class="text-muted-foreground/40 h-5 w-5" />
                    <span
                        class="absolute inset-y-0 left-0 overflow-hidden"
                        style="width: {starFillPercent(displayValue, star)}%"
                    >
                        <Star
                            class="h-5 w-5 {isMyFill(star)
                                ? 'fill-primary text-primary'
                                : 'fill-amber-400 text-amber-400'}"
                        />
                    </span>
                </span>
            </button>
        {/each}
    </div>
    <span class="text-muted-foreground text-sm">
        {#if rating.count > 0}
            <!-- n<3 착시 방지: 참여 3명 미만이면 평균 숫자를 내세우지 않는다(rating-display 규약) -->
            {#if shouldShowAverage(rating.count)}
                <span class="text-foreground font-medium">★{rating.avg.toFixed(1)}</span>
                · 앙님 {rating.count.toLocaleString()}명
            {:else}
                앙님 {rating.count.toLocaleString()}명 평가
            {/if}
        {:else}
            첫 별점을 남겨주세요
        {/if}
        {#if rating.my > 0}
            <span class="text-primary ml-1">내 별점 ★{rating.my}</span>
        {/if}
    </span>
</div>

<!--
    항목별 평점(맛/가성비 등) — 프리셋이 매핑된 보드(앙지도)에서만. 표시(평균 바)는 공개,
    입력 [+ 항목별로 자세히] 는 본인 총점(rating.my>0) + 투표 등급(canVote) 옵트인 게이트.
-->
{#if aspectPreset}
    <RatingAspects
        {boardId}
        {postId}
        preset={aspectPreset}
        initial={aspects ?? []}
        canEdit={canVote && rating.my > 0}
    />
{/if}
