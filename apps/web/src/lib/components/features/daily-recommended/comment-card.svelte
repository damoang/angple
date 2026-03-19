<script lang="ts">
    import type { RecommendedComment } from '$lib/api/types.js';
    import {
        formatNumber,
        getRecommendBadgeClass
    } from '../../features/recommended/utils/index.js';

    let { comment }: { comment: RecommendedComment } = $props();
</script>

<li>
    <a
        href={comment.url}
        class="hover:bg-muted block rounded px-2 py-1.5 transition-all duration-200 ease-out"
    >
        <div class="flex items-start gap-2">
            <span
                class="mt-0.5 inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                    comment.recommend_count
                )}"
            >
                {formatNumber(comment.recommend_count)}
            </span>
            <div class="min-w-0 flex-1">
                <p class="text-muted-foreground truncate text-xs" title={comment.parent_title}>
                    {comment.parent_title}
                </p>
                <p
                    class="mt-0.5 line-clamp-2 text-sm leading-relaxed"
                    style="font-size: var(--recommend-font-size, 0.9rem)"
                >
                    {comment.content}
                </p>
            </div>
        </div>
    </a>
</li>
