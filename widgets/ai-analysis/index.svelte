<script lang="ts">
    /**
     * AI 트렌드 분석 위젯
     *
     * recommended 위젯에서 AI 분석 부분만 독립시킨 위젯.
     * Gemini API를 통해 커뮤니티 트렌드를 분석하여 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import type { RecommendedDataWithAI, RecommendedPeriod, AIAnalysis } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import { apiClient } from '$lib/api';
    import { AITrendCard } from '$lib/components/features/recommended/components/ai-trend';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    const period = $derived((config.settings?.period as RecommendedPeriod) ?? '6h');
    const showKeywords = $derived((config.settings?.showKeywords as boolean) ?? true);
    const showStats = $derived((config.settings?.showStats as boolean) ?? true);

    let analysis = $state<AIAnalysis | null>(null);
    let stats = $state<{ total_recommends: number; total_comments: number } | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    function calculateStats(data: RecommendedDataWithAI) {
        let total_recommends = 0;
        let total_comments = 0;

        const sections = ['community', 'group', 'info'] as const;
        for (const key of sections) {
            const section = data.sections[key];
            if (section?.posts) {
                for (const post of section.posts) {
                    total_recommends += post.recommend_count || 0;
                    total_comments += post.comment_count || 0;
                }
            }
        }

        return { total_recommends, total_comments };
    }

    async function loadAnalysis() {
        loading = true;
        error = null;
        try {
            const data = await apiClient.getRecommendedPostsWithAI(period);
            analysis = data.ai_analysis ?? null;
            if (analysis && showStats) {
                stats = calculateStats(data);
            }
        } catch (err) {
            error = err instanceof Error ? err.message : '분석 데이터 로드 실패';
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        loadAnalysis();
    });
</script>

{#if loading}
    <div class="bg-muted/30 animate-pulse rounded-xl p-4">
        <div class="bg-muted h-4 w-1/3 rounded"></div>
        <div class="bg-muted mt-2 h-3 w-2/3 rounded"></div>
    </div>
{:else if error}
    <div class="text-muted-foreground py-2 text-center text-xs">{error}</div>
{:else if analysis}
    <AITrendCard {analysis} stats={showStats ? stats : undefined} />
{/if}
