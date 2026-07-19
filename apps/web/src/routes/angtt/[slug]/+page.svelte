<script lang="ts">
    /**
     * 앙티티 작품 전용 페이지 (커뮤니티 우선 레이아웃)
     *
     * 설계 원칙(시안):
     *   ① 커뮤니티가 주인공 — 헤드라인은 우리 별점 + 앙님 후기. 외부 점수는 하단 각주.
     *   ② 가짜 후기 없음 — 후기는 실제 연결된 앙님 글만. 없으면 "첫 후기 남기기"로 초대.
     *   ③ 작품당 회원 1표 — 별점은 글이 아니라 작품 단위(대표 점수 하나).
     *
     * 데이터는 +page.server.ts 가 플러그인 lib 을 위임 호출해 SSR 확정한다.
     * 이번 슬라이스는 읽기 전용 — 별점 쓰기(내 별점 남기기)는 UI 만, 배선은 후속.
     */
    import { SeoHead, createRatedItemJsonLd, getSiteUrl } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import type { PageData } from './$types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { buildGradeDeniedMessage } from '$lib/utils/board-permissions.js';
    import {
        RATING_MIN_LEVEL,
        applyOptimisticRating
    } from '$lib/components/features/board/post-rating-logic.js';

    const { data }: { data: PageData } = $props();

    const entity = $derived(data.entity);
    const posts = $derived(data.posts);
    const rating = $derived(data.rating);

    /**
     * 헤드라인 별점의 클라이언트 소유 상태(낙관적 갱신 대상).
     * SSR 집계를 시작점으로 스냅샷하고, 내 별점 제출 시 이 값만 갱신한다.
     * my 는 서버 규약상 number|null → 위젯 계산 편의로 0(=없음)으로 정규화.
     */
    // svelte-ignore state_referenced_locally
    let liveRating = $state({
        avg: data.rating.avg,
        count: data.rating.count,
        my: data.rating.my ?? 0
    });
    // 슬러그 이동으로 컴포넌트가 재사용될 때만 SSR 값으로 재동기화(낙관적 상태 보존)
    // svelte-ignore state_referenced_locally
    let trackedSlug = $state(data.entity.slug);
    $effect(() => {
        if (data.entity.slug !== trackedSlug) {
            trackedSlug = data.entity.slug;
            liveRating = {
                avg: data.rating.avg,
                count: data.rating.count,
                my: data.rating.my ?? 0
            };
        }
    });

    /** 커뮤니티 별점(작품 단위)이 실제로 있는지 */
    const hasRating = $derived(liveRating.count >= 1 && liveRating.avg > 0);
    const avgText = $derived(hasRating ? liveRating.avg.toFixed(1) : '–');
    /** ★ 채움/빈 별 문자열 (반올림) */
    const starText = $derived.by(() => {
        const filled = hasRating ? Math.round(liveRating.avg) : 0;
        return '★★★★★'.slice(0, filled) + '☆☆☆☆☆'.slice(0, 5 - filled);
    });

    /** 엔티티 type(영문 소문자) → 한글 라벨 + schema 카테고리 매핑 */
    const TYPE_LABEL: Record<string, string> = {
        movie: '영화',
        drama: '드라마',
        netflix: 'NETFLIX',
        documentary: '다큐',
        webtoon: '웹툰',
        comic: '만화',
        novel: '소설',
        book: '책',
        game: '게임',
        show: '공연',
        exhibition: '전시'
    };
    const typeLabel = $derived(TYPE_LABEL[entity.type] ?? entity.type);
    const releaseYear = $derived(entity.releaseDate ? entity.releaseDate.slice(0, 4) : '');

    /** 외부 점수 칩 (external_ids 가 있을 때만 "참고용"으로 하단 표시) */
    const externalChips = $derived.by(() => {
        const ext = entity.externalIds;
        if (!ext || typeof ext !== 'object') return [];
        return Object.entries(ext)
            .filter(([, v]) => v != null && v !== '')
            .map(([source, value]) => ({ source, value: String(value) }));
    });

    /** 후기 카드용: 작성자 닉네임 폴백 */
    function nick(name: string): string {
        return name?.trim() || '앙님';
    }
    // ── 작품 별점 남기기(작품당 회원 1표, 낙관적 갱신 + 실패 롤백) ──
    const RATE_STARS = [1, 2, 3, 4, 5];
    let showRater = $state(false);
    let hoverStar = $state(0);
    let submitting = $state(false);
    let rateError = $state('');

    /** 로그인 + 앙님💛(mb_level 3) 이상만 투표 가능(be#562 게시글 별점과 동일 관례) */
    const canVote = $derived(
        authStore.isAuthenticated && (authStore.user?.mb_level ?? 1) >= RATING_MIN_LEVEL
    );
    /** 입력 위젯 채움 기준: 호버 중이면 호버 값, 아니면 내 기존 별점 */
    const raterValue = $derived(hoverStar > 0 ? hoverStar : liveRating.my);

    function onRateClick() {
        showRater = !showRater;
        rateError = '';
    }

    async function submitRating(star: number): Promise<void> {
        if (submitting) return;
        rateError = '';
        if (!authStore.isAuthenticated) {
            rateError = '별점을 남기려면 로그인이 필요해요.';
            return;
        }
        const level = authStore.user?.mb_level ?? 1;
        if (level < RATING_MIN_LEVEL) {
            rateError = buildGradeDeniedMessage('별점 남기기', RATING_MIN_LEVEL, level);
            return;
        }

        const prev = { ...liveRating };
        liveRating = applyOptimisticRating(prev, star); // 낙관적 갱신
        hoverStar = 0;
        submitting = true;
        try {
            const res = await fetch(`/api/angtt/${entity.slug}/rating`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ rating: star })
            });
            const body = (await res.json().catch(() => null)) as {
                avg?: number;
                count?: number;
                my?: number | null;
                error?: string;
            } | null;
            if (!res.ok) throw new Error(body?.error || '별점 등록에 실패했어요.');
            liveRating = {
                avg: typeof body?.avg === 'number' ? body.avg : liveRating.avg,
                count: typeof body?.count === 'number' ? body.count : liveRating.count,
                my: body?.my ?? star
            };
        } catch (err) {
            liveRating = prev; // 실패 롤백
            rateError = err instanceof Error ? err.message : '별점 등록에 실패했어요.';
        } finally {
            submitting = false;
        }
    }

    // ── SEO: 커뮤니티 별점만 AggregateRating(참여<1 이면 null → 블록 생략) ──
    const seoConfig = $derived.by<SeoConfig>(() => {
        const siteUrl = getSiteUrl();
        const pageUrl = `${siteUrl}/angtt/${entity.slug}`;
        const desc = `${entity.canonicalTitle} — 다모앙 앙님들의 진짜 후기와 별점.${
            hasRating ? ` 커뮤니티 별점 ${avgText}/5 (${rating.count}명 참여)` : ''
        }`;
        return {
            meta: {
                title: `${entity.canonicalTitle} — 앙티티 리뷰`,
                description: desc,
                canonicalUrl: pageUrl
            },
            og: {
                title: `${entity.canonicalTitle} — 앙티티 리뷰`,
                description: desc,
                type: 'article',
                url: pageUrl,
                image: entity.posterUrl || undefined
            },
            jsonLd: [
                hasRating
                    ? createRatedItemJsonLd({
                          name: entity.canonicalTitle,
                          category: typeLabel,
                          ratingValue: rating.avg,
                          ratingCount: rating.count,
                          url: pageUrl,
                          image: entity.posterUrl || undefined
                      })
                    : null
            ]
        };
    });
</script>

<SeoHead config={seoConfig} />

<div class="mx-auto max-w-[940px] px-4 py-6 sm:py-10">
    <!-- eyebrow -->
    <div
        class="text-muted-foreground mb-5 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest"
    >
        <span class="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true"></span>
        앙티티 리뷰 · 작품 페이지
    </div>

    <!-- ===== WORK HERO ===== -->
    <div
        class="bg-card grid grid-cols-1 gap-6 rounded-xl border p-5 shadow-sm sm:grid-cols-[200px_1fr] sm:gap-8 sm:p-7"
    >
        <!-- poster -->
        <div class="mx-auto w-full max-w-[180px] sm:mx-0 sm:max-w-none">
            {#if entity.posterUrl}
                <img
                    src={entity.posterUrl}
                    alt="{entity.canonicalTitle} 포스터"
                    class="aspect-[2/3] w-full rounded-lg object-cover shadow"
                    loading="eager"
                />
            {:else}
                <div
                    class="flex aspect-[2/3] w-full flex-col justify-end rounded-lg border border-black/30 bg-gradient-to-br from-[#2a2118] to-[#0c0a07] p-4"
                    aria-hidden="true"
                >
                    <div class="text-lg font-extrabold leading-tight text-[#f6ecd6]">
                        {entity.canonicalTitle}
                    </div>
                    {#if typeLabel || releaseYear}
                        <div class="mt-1 text-xs text-[#c9a85e]">
                            {[typeLabel, releaseYear].filter(Boolean).join(' · ')}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- meta + score -->
        <div class="min-w-0">
            <div class="text-muted-foreground flex flex-wrap items-center gap-2 text-sm font-bold">
                {#if typeLabel}<span>{typeLabel}</span>{/if}
                {#if releaseYear}<span class="opacity-50">·</span><span>{releaseYear}</span>{/if}
            </div>
            <h1 class="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                {entity.canonicalTitle}
            </h1>
            <p class="text-muted-foreground mb-5 mt-1 text-sm">다모앙 앙님들의 진짜 후기와 별점.</p>

            <!-- community score block — the bold place -->
            <div
                class="grid grid-cols-1 items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-[auto_1fr] dark:border-amber-900/50 dark:bg-amber-950/30"
            >
                <div>
                    <div class="flex items-baseline gap-1.5">
                        <span
                            class="text-5xl font-extrabold tabular-nums tracking-tighter text-amber-600 sm:text-6xl dark:text-amber-400"
                            >{avgText}</span
                        >
                        <span class="text-muted-foreground text-base font-semibold">/ 5</span>
                    </div>
                    <div class="mt-1.5 text-lg tracking-widest text-amber-500">{starText}</div>
                    {#if hasRating}
                        <div class="text-muted-foreground mt-1 text-sm">
                            앙님 <b class="text-foreground tabular-nums">{rating.count}</b>명이
                            별점을 남겼어요
                        </div>
                    {:else}
                        <div class="text-muted-foreground mt-1 text-sm">
                            아직 별점이 없어요 — 첫 별점을 남겨주세요
                        </div>
                    {/if}
                </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2.5">
                <button
                    type="button"
                    onclick={onRateClick}
                    aria-expanded={showRater}
                    class="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-bold text-amber-950 shadow hover:brightness-105"
                >
                    ⭐ {liveRating.my > 0 ? '내 별점 수정하기' : '내 별점 남기기'}
                </button>
                <a
                    href="/free/write"
                    class="hover:bg-muted inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-bold"
                >
                    후기 쓰기
                </a>
            </div>

            {#if showRater}
                <div class="bg-card mt-3 rounded-lg border p-3.5">
                    {#if authStore.isAuthenticated && !canVote}
                        <p class="text-muted-foreground text-sm">
                            {buildGradeDeniedMessage(
                                '별점 남기기',
                                RATING_MIN_LEVEL,
                                authStore.user?.mb_level ?? 1
                            )}
                        </p>
                    {:else if !authStore.isAuthenticated}
                        <p class="text-sm">
                            별점을 남기려면 <a
                                href="/login"
                                class="font-bold text-amber-600 underline dark:text-amber-400"
                                >로그인</a
                            >이 필요해요.
                        </p>
                    {:else}
                        <div
                            class="flex items-center gap-1"
                            role="radiogroup"
                            aria-label="작품 별점 선택 (1~5점)"
                        >
                            {#each RATE_STARS as star (star)}
                                <button
                                    type="button"
                                    class="p-0.5 text-2xl leading-none transition-transform hover:scale-110 disabled:opacity-50"
                                    disabled={submitting}
                                    role="radio"
                                    aria-checked={liveRating.my === star}
                                    aria-label="별점 {star}점"
                                    onclick={() => submitRating(star)}
                                    onmouseenter={() => (hoverStar = star)}
                                    onmouseleave={() => (hoverStar = 0)}
                                    onfocus={() => (hoverStar = star)}
                                    onblur={() => (hoverStar = 0)}
                                >
                                    <span
                                        class={star <= raterValue
                                            ? 'text-amber-500'
                                            : 'text-muted-foreground/40'}>★</span
                                    >
                                </button>
                            {/each}
                            {#if liveRating.my > 0}
                                <span class="text-muted-foreground ml-2 text-sm"
                                    >내 별점 ★{liveRating.my}</span
                                >
                            {/if}
                        </div>
                    {/if}
                    {#if rateError}
                        <p class="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
                            {rateError}
                        </p>
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <!-- ===== 앙님 후기 (주인공) ===== -->
    <section class="mt-8">
        <div class="mb-3.5 flex items-baseline justify-between gap-3">
            <h2 class="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <span
                    class="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400"
                    >앙님 후기</span
                >
                우리 커뮤니티가 남긴 진짜 후기
            </h2>
        </div>

        {#if posts.length > 0}
            <div class="flex flex-col gap-3">
                {#each posts as post (post.boTable + ':' + post.wrId)}
                    <div
                        class="bg-card rounded-xl border p-4 transition-colors hover:border-amber-200 dark:hover:border-amber-900/50"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <a
                                href="/{post.boTable}/{post.wrId}"
                                class="font-bold hover:text-amber-600 dark:hover:text-amber-400"
                            >
                                {post.subject || '(제목 없음)'}
                            </a>
                            {#if post.good > 0}
                                <span
                                    class="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                                >
                                    ▲ {post.good}
                                </span>
                            {/if}
                        </div>
                        <div
                            class="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-2 text-sm"
                        >
                            <span class="text-foreground font-semibold">{nick(post.name)}</span>
                            <span class="opacity-50">·</span>
                            <span>{post.boTable}</span>
                            {#if post.role === 'review'}
                                <span class="opacity-50">·</span>
                                <span class="text-amber-600 dark:text-amber-400">후기</span>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <!-- empty state -->
            <div
                class="bg-card flex flex-col items-center gap-4 rounded-xl border border-dashed border-amber-200 p-6 text-center sm:flex-row sm:text-left dark:border-amber-900/50"
            >
                <div
                    class="flex aspect-[2/3] w-16 shrink-0 items-end rounded-lg bg-gradient-to-br from-[#2a2118] to-[#0c0a07] p-2 text-xs font-bold text-[#c9a85e]"
                    aria-hidden="true"
                >
                    {entity.canonicalTitle}
                </div>
                <div class="flex-1">
                    <h3 class="text-base font-extrabold">
                        「{entity.canonicalTitle}」 — 아직 후기가 없어요
                    </h3>
                    <p class="text-muted-foreground mt-1 text-sm">
                        첫 후기와 첫 별점의 주인공이 되어주세요. 「앙티티」 태그로 글을 쓰면 이곳에
                        모여요.
                    </p>
                </div>
                <a
                    href="/free/write"
                    class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-bold text-amber-950 shadow hover:brightness-105"
                >
                    ✍️ 첫 후기·첫 별점 남기기
                </a>
            </div>
        {/if}
    </section>

    <!-- ===== 외부 점수 (참고 · 하단 보조) ===== -->
    {#if externalChips.length > 0}
        <div class="bg-muted/50 mt-7 rounded-xl border p-4">
            <div
                class="text-muted-foreground mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            >
                🔎 다른 곳 점수 (참고용)
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
                {#each externalChips as chip (chip.source)}
                    <span
                        class="bg-card inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                    >
                        <b class="text-foreground font-bold tabular-nums">{chip.value}</b>
                        <span class="text-muted-foreground text-xs tracking-wide"
                            >{chip.source}</span
                        >
                    </span>
                {/each}
            </div>
            <p class="text-muted-foreground mt-2.5 text-xs">
                외부 점수는 참고용이며, 다모앙 커뮤니티 별점과 합산하지 않습니다.
            </p>
        </div>
    {/if}
</div>
