<script lang="ts">
    import type { AIAnalysis } from '$lib/api/types.js';
    import { HeadlineRotator, KeywordBadges } from './index.js';

    let {
        analysis,
        stats
    }: {
        analysis: AIAnalysis;
        stats?: { total_recommends: number; total_comments: number };
    } = $props();

    // Ambient whisper 텍스트 생성
    const whisperText = $derived(
        [...(analysis.ambient_whisper || []), ...(analysis.analysis_commentary || [])]
            .filter(Boolean)
            .join(' · ')
    );

    // 숫자 포맷
    function formatNumber(num: number): string {
        return num.toLocaleString();
    }
</script>

<!-- AI 트렌드 분석 카드 - ang-gnu 스타일 재현 -->
<div
    class="border-border group relative mb-3 flex items-center gap-3 overflow-hidden rounded-xl border bg-gradient-to-r from-amber-50/50 to-orange-50/30 p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md dark:from-slate-800/50 dark:to-slate-900/30"
    role="region"
    aria-label="AI 트렌드 분석"
>
    <!-- 앙 AI 캐릭터 이미지 -->
    <div class="hidden shrink-0 sm:block">
        <img
            src="{import.meta.env
                .VITE_S3_URL}/data/editor/2509/5770b-68ca37f63464f-24fb734ab222da3cff7aee7898aedce5e1c3c360.webp"
            alt="앙 AI 캐릭터"
            width="48"
            height="48"
            class="size-12 object-contain"
            loading="lazy"
        />
    </div>

    <div class="min-w-0 flex-1">
        <!-- 키워드 + 통계 -->
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <!-- 키워드 배지 -->
            <KeywordBadges keywords={analysis.keywords} />

            <!-- 통계 (데스크톱에서만) -->
            {#if stats}
                <div
                    class="hidden items-center gap-3 text-[13px] sm:flex"
                    role="list"
                    aria-label="트렌드 통계"
                >
                    <span class="flex items-center gap-1" role="listitem">
                        <span>👍</span>
                        <span class="text-foreground font-medium"
                            >{formatNumber(stats.total_recommends)}</span
                        >
                    </span>
                    <span class="flex items-center gap-1" role="listitem">
                        <span>💬</span>
                        <span class="text-foreground font-medium"
                            >{formatNumber(stats.total_comments)}</span
                        >
                    </span>
                    <span class="flex items-center gap-1.5" role="listitem">
                        <span>🔥</span>
                        <span class="text-foreground font-medium">{analysis.trend_score}</span>
                        <!-- 진행 바 -->
                        <div
                            class="bg-dusty-200 dark:bg-dusty-700 h-1 w-12 overflow-hidden rounded-full"
                        >
                            <div
                                class="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                                style="width: {Math.min(analysis.trend_score, 100)}%"
                            ></div>
                        </div>
                    </span>
                </div>
            {/if}
        </div>

        <!-- 헤드라인 로테이터 -->
        <div class="mb-1.5">
            <HeadlineRotator headlines={analysis.trend_summary.headline} />
        </div>

        <!-- Ambient Whisper (가로 스크롤) -->
        {#if whisperText}
            <div class="h-5 overflow-hidden">
                <div class="animate-scroll-left inline-block whitespace-nowrap">
                    <span class="text-muted-foreground text-xs dark:text-cyan-300/70">
                        {whisperText}
                    </span>
                </div>
            </div>
        {/if}
    </div>
</div>

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
