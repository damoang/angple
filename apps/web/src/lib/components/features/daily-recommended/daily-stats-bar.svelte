<script lang="ts">
    import type { DailyRecommendedStats } from '$lib/api/types.js';

    interface Props {
        stats: DailyRecommendedStats;
    }

    const { stats }: Props = $props();
</script>

<div
    class="bg-muted/50 text-muted-foreground mb-3 flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 text-xs"
>
    <span>
        총 <strong class="text-foreground">{stats.total_recommended_posts}</strong>건
    </span>
    <span class="hidden sm:inline">·</span>
    <span>
        최대 추천 <strong class="text-foreground">{stats.max_recommend_count}</strong>
    </span>
    <span class="hidden sm:inline">·</span>
    <span>
        평균 추천 <strong class="text-foreground">{stats.avg_recommend_count.toFixed(1)}</strong>
    </span>
</div>
