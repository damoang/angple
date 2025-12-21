<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { cn } from '$lib/utils';
    import type { AiTrendCardProps } from './types.js';

    // Props
    let {
        data = null,
        loading = false,
        error = null,
        class: className = ''
    }: AiTrendCardProps = $props();

    // State
    let currentHeadlineIndex = $state(0);
    let headlineInterval: ReturnType<typeof setInterval> | null = null;

    // 앙 캐릭터 이미지 URL
    const angCharacterImage =
        'https://s3.damoang.net/data/editor/2509/5770b-68ca37f63464f-24fb734ab222da3cff7aee7898aedce5e1c3c360.webp';

    // 헤드라인 로테이션
    function startHeadlineRotation() {
        if (data?.headline_array && data.headline_array.length > 1) {
            headlineInterval = setInterval(() => {
                currentHeadlineIndex =
                    (currentHeadlineIndex + 1) % (data?.headline_array?.length || 1);
            }, 4000);
        }
    }

    function stopHeadlineRotation() {
        if (headlineInterval) {
            clearInterval(headlineInterval);
            headlineInterval = null;
        }
    }

    onMount(() => {
        startHeadlineRotation();
    });

    onDestroy(() => {
        stopHeadlineRotation();
    });

    // 숫자 포맷
    function formatNumber(num: number): string {
        return num.toLocaleString();
    }

    // 헤드라인 배열 가져오기
    const headlines = $derived(data?.headline_array || (data?.summary ? [data.summary] : []));

    // 키워드 가져오기 (최대 5개)
    const keywords = $derived((data?.keywords || []).slice(0, 5));

    // Ambient whisper 텍스트
    const whisperText = $derived(
        [data?.ambient_whisper, data?.analysis_commentary].filter(Boolean).join(' · ')
    );
</script>

{#if loading}
    <!-- 로딩 상태 -->
    <div
        class={cn(
            'border-border bg-background relative flex items-center gap-3 rounded-xl border p-3',
            'animate-pulse',
            className
        )}
    >
        <div class="bg-muted size-12 shrink-0 rounded-full"></div>
        <div class="flex-1 space-y-2">
            <div class="flex gap-1.5">
                <div class="bg-muted h-5 w-16 rounded-full"></div>
                <div class="bg-muted h-5 w-12 rounded-full"></div>
                <div class="bg-muted h-5 w-14 rounded-full"></div>
            </div>
            <div class="bg-muted h-4 w-3/4 rounded"></div>
        </div>
    </div>
{:else if error}
    <!-- 에러 상태 -->
    <div
        class={cn(
            'border-destructive/30 bg-destructive/5 flex items-center gap-3 rounded-xl border p-3',
            className
        )}
    >
        <span class="text-destructive text-sm">{error}</span>
    </div>
{:else if data}
    <!-- 정상 데이터 표시 -->
    <div
        class={cn(
            'border-border bg-background group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3',
            'transition-all duration-200 ease-out',
            'hover:-translate-y-0.5 hover:shadow-md',
            className
        )}
        role="region"
        aria-label="AI 트렌드 분석"
    >
        <!-- 앙 캐릭터 이미지 -->
        <div class="hidden shrink-0 sm:block">
            <img
                src={angCharacterImage}
                alt="앙 AI 캐릭터"
                class="size-12 object-contain"
                loading="lazy"
            />
        </div>

        <!-- 콘텐츠 영역 -->
        <div class="min-w-0 flex-1">
            <!-- 키워드 + 통계 -->
            {#if keywords.length > 0}
                <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <!-- 키워드 뱃지 -->
                    <div class="flex flex-wrap gap-1">
                        {#each keywords as keyword (keyword)}
                            <span
                                class="inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-xs font-medium text-slate-900"
                            >
                                #{keyword}
                            </span>
                        {/each}
                    </div>

                    <!-- 통계 (데스크톱에서만) -->
                    <div class="hidden items-center gap-3 text-xs sm:flex">
                        <span class="flex items-center gap-1">
                            <span>👍</span>
                            <span class="text-foreground font-medium"
                                >{formatNumber(data.stats.total_recommends)}</span
                            >
                        </span>
                        <span class="flex items-center gap-1">
                            <span>💬</span>
                            <span class="text-foreground font-medium"
                                >{formatNumber(data.stats.total_comments)}</span
                            >
                        </span>
                        <span class="flex items-center gap-1.5">
                            <span>🔥</span>
                            <span class="text-foreground font-medium">{data.score}</span>
                            <!-- 진행 바 -->
                            <div
                                class="bg-dusty-200 dark:bg-dusty-700 h-1 w-12 overflow-hidden rounded-full"
                            >
                                <div
                                    class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                                    style="width: {Math.min(data.score, 100)}%"
                                ></div>
                            </div>
                        </span>
                    </div>
                </div>
            {/if}

            <!-- 헤드라인 (수직 로테이션) -->
            {#if headlines.length > 0}
                <div class="relative h-6 overflow-hidden">
                    {#each headlines as headline, idx (idx)}
                        <div
                            class={cn(
                                'absolute inset-0 transform transition-all duration-500 ease-in-out',
                                idx === currentHeadlineIndex
                                    ? 'translate-y-0 opacity-100'
                                    : idx < currentHeadlineIndex
                                      ? '-translate-y-full opacity-0'
                                      : 'translate-y-full opacity-0'
                            )}
                        >
                            <p class="text-foreground truncate text-sm font-bold">{headline}</p>
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- Ambient Whisper (가로 스크롤) -->
            {#if whisperText}
                <div class="mt-1.5 h-5 overflow-hidden">
                    <div class="animate-scroll-left inline-block whitespace-nowrap">
                        <span class="text-muted-foreground text-xs dark:text-cyan-300/80">
                            {whisperText}
                        </span>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{:else}
    <!-- 데이터 없음 -->
    <div
        class={cn(
            'border-border bg-background flex items-center gap-3 rounded-xl border p-3',
            className
        )}
    >
        <span class="text-muted-foreground text-sm">트렌드 데이터가 없습니다.</span>
    </div>
{/if}

<style>
    /* 가로 스크롤 애니메이션 */
    @keyframes scroll-left {
        0% {
            transform: translateX(0%);
        }
        100% {
            transform: translateX(-100%);
        }
    }

    .animate-scroll-left {
        animation: scroll-left 50s linear infinite;
        will-change: transform;
    }

    /* 호버 시 애니메이션 일시정지 */
    .group:hover .animate-scroll-left {
        animation-play-state: paused;
    }
</style>
