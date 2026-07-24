<script lang="ts">
    /**
     * 항목별 평점 — 표시(평균 바) + 옵트인 입력(별점 행). 범용 재사용 컴포넌트.
     *
     * 총점 위젯(post-rating.svelte)의 부가 시각이다. 총점을 남긴 회원에게만
     * [+ 항목별로 자세히] 접힘 버튼을 노출하고, 안 펼치면 화면 변화 0(옵트인).
     * 저장은 범용 API `PUT /api/boards/{boardId}/{postId}/rating/aspects`(공유 핸들러).
     *
     * n<3 착시 방지: 표본이 적은 항목은 평균 숫자를 내세우지 않고 인원만 보여준다
     * (rating-display 규약 · shouldShowAverage).
     *
     * ⛔ 프리셋(맛/가성비 등)은 전적으로 prop 으로 받는다 — 국가·도메인 가정 없음.
     */
    import type { AspectDef } from '$plugins/angtt-review/lib/aspect-presets';
    import { type AspectRating, shouldShowAverage } from './rating-display.js';

    let {
        boardId,
        postId,
        preset,
        initial,
        canEdit = false
    }: {
        boardId: string;
        postId: number | string;
        preset: AspectDef[];
        initial: AspectRating[];
        /** 본인 총점 별점 보유 + 투표 등급 충족 시에만 입력 UI 노출(옵트인 게이트) */
        canEdit?: boolean;
    } = $props();

    const RATE_STARS = [1, 2, 3, 4, 5];

    // 집계+본인 값의 클라이언트 소유 상태 — 저장 응답으로 통째 교체.
    // svelte-ignore state_referenced_locally
    let liveAspects = $state<AspectRating[]>(initial ?? []);
    let showAspectRater = $state(false);
    let aspectSubmitting = $state<string | null>(null);
    let aspectError = $state('');
    let aspectHover = $state<{ key: string; star: number } | null>(null);

    // 글 이동(컴포넌트 재사용)으로 postId 가 바뀌면 SSR 값으로 재동기화 + 접힘 초기화.
    // svelte-ignore state_referenced_locally
    let trackedPostId = $state(postId);
    $effect(() => {
        if (postId !== trackedPostId) {
            trackedPostId = postId;
            liveAspects = initial ?? [];
            showAspectRater = false;
            aspectError = '';
        }
    });

    /** 표시용 바 — 집계가 1건이라도 있는 항목만, 프리셋 순서로 */
    const aspectBars = $derived.by(() => {
        const byKey = new Map(liveAspects.map((a) => [a.aspect, a]));
        return preset.flatMap((def) => {
            const agg = byKey.get(def.key);
            return agg && agg.count > 0
                ? [{ key: def.key, label: def.label, avg: agg.avg, count: agg.count }]
                : [];
        });
    });

    /** 본인이 해당 항목에 남긴 별점(없으면 0) */
    function myAspect(key: string): number {
        return liveAspects.find((a) => a.aspect === key)?.my ?? 0;
    }
    /** 입력 위젯 채움 기준: 호버 중이면 호버 값, 아니면 내 기존 값 */
    function aspectRowValue(key: string): number {
        return aspectHover?.key === key ? aspectHover.star : myAspect(key);
    }

    async function submitAspect(key: string, star: number): Promise<void> {
        if (aspectSubmitting) return;
        aspectError = '';
        aspectSubmitting = key;
        try {
            const res = await fetch(`/api/boards/${boardId}/${postId}/rating/aspects`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ aspects: { [key]: star } })
            });
            const body = (await res.json().catch(() => null)) as {
                aspects?: AspectRating[];
                error?: string;
            } | null;
            if (!res.ok) throw new Error(body?.error || '항목별 평가 저장에 실패했어요.');
            if (Array.isArray(body?.aspects)) liveAspects = body.aspects;
        } catch (err) {
            aspectError = err instanceof Error ? err.message : '항목별 평가 저장에 실패했어요.';
        } finally {
            aspectSubmitting = null;
        }
    }
</script>

{#if aspectBars.length > 0}
    <!-- 항목별 평균(옵트인 세부) — 집계가 1건이라도 있을 때만 표시 -->
    <div class="mt-2 flex w-full max-w-sm flex-col gap-1.5" aria-label="항목별 평균 별점">
        {#each aspectBars as bar (bar.key)}
            <div class="flex items-center gap-2 text-xs">
                <span class="text-muted-foreground w-12 shrink-0 font-semibold">{bar.label}</span>
                {#if shouldShowAverage(bar.count)}
                    <div
                        class="h-1.5 flex-1 overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-900/40"
                        aria-hidden="true"
                    >
                        <div
                            class="h-full rounded-full bg-amber-500"
                            style="width: {(bar.avg / 5) * 100}%"
                        ></div>
                    </div>
                    <span class="text-foreground w-7 shrink-0 text-right font-bold tabular-nums"
                        >{bar.avg.toFixed(1)}</span
                    >
                    <span class="text-muted-foreground shrink-0 tabular-nums">({bar.count})</span>
                {:else}
                    <!-- n<3 착시 방지: 표본 적으면 평균 숨김, 인원만 -->
                    <span class="text-muted-foreground flex-1">앙님 {bar.count}명 평가</span>
                {/if}
            </div>
        {/each}
    </div>
{/if}

{#if canEdit}
    <!-- 항목별 평가(옵트인) — 본인 총점이 있을 때만 접힘 버튼 노출 -->
    <div class="mt-2">
        <button
            type="button"
            onclick={() => (showAspectRater = !showAspectRater)}
            aria-expanded={showAspectRater}
            class="text-muted-foreground hover:text-foreground text-sm font-semibold"
        >
            {showAspectRater ? '−' : '+'} 항목별로 자세히 평가
        </button>
        {#if showAspectRater}
            <div class="mt-2.5 flex flex-col gap-1.5">
                {#each preset as def (def.key)}
                    <div class="flex items-center gap-2">
                        <span class="w-14 shrink-0 text-sm font-semibold">{def.label}</span>
                        <div
                            class="flex items-center"
                            role="radiogroup"
                            aria-label="{def.label} 별점 선택 (1~5점)"
                        >
                            {#each RATE_STARS as star (star)}
                                <button
                                    type="button"
                                    class="p-0.5 text-xl leading-none transition-transform hover:scale-110 disabled:opacity-50"
                                    disabled={aspectSubmitting != null}
                                    role="radio"
                                    aria-checked={myAspect(def.key) === star}
                                    aria-label="{def.label} {star}점"
                                    onclick={() => submitAspect(def.key, star)}
                                    onmouseenter={() => (aspectHover = { key: def.key, star })}
                                    onmouseleave={() => (aspectHover = null)}
                                    onfocus={() => (aspectHover = { key: def.key, star })}
                                    onblur={() => (aspectHover = null)}
                                >
                                    <span
                                        class={star <= aspectRowValue(def.key)
                                            ? 'text-amber-500'
                                            : 'text-muted-foreground/40'}>★</span
                                    >
                                </button>
                            {/each}
                        </div>
                        {#if myAspect(def.key) > 0}
                            <span class="text-muted-foreground text-xs tabular-nums"
                                >★{myAspect(def.key)}</span
                            >
                        {/if}
                    </div>
                {/each}
                <p class="text-muted-foreground text-xs">
                    별을 누르면 항목마다 바로 저장돼요. 원하는 항목만 남겨도 됩니다.
                </p>
            </div>
            {#if aspectError}
                <p class="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                    {aspectError}
                </p>
            {/if}
        {/if}
    </div>
{/if}
