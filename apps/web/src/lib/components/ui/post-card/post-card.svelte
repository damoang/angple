<script lang="ts">
    import type { RecommendedPost } from '$lib/api/types.js';
    import { formatNumber, getRecommendBadgeClass } from '../../features/recommended/utils/index.js';

    let { post }: { post: RecommendedPost } = $props();
</script>

<!-- PHP 원본 list-group-item 스타일 재현 -->
<li class="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
    <a
        href={post.url}
        class="block rounded px-2 py-0.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
    >
        <div class="flex items-center gap-2">
            <!-- rcmd-box + rcmd-sm 스타일 -->
            <span
                class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded px-2 py-0.5 text-sm font-bold {getRecommendBadgeClass(
                    post.recommend_count
                )}"
            >
                {formatNumber(post.recommend_count)}
            </span>
            <!-- text-truncate -->
            <div class="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {post.title}
            </div>
        </div>
    </a>
</li>
