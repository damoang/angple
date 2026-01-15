<script lang="ts">
    import type { RecommendedPost } from '$lib/api/types.js';
    import {
        formatNumber,
        getRecommendBadgeClass
    } from '../../features/recommended/utils/index.js';

    let { post }: { post: RecommendedPost } = $props();
</script>

<!-- PHP 원본 list-group-item 스타일 재현 -->
<li>
    <a
        href={post.url}
        class="hover:bg-muted block rounded px-2 py-1.5 transition-all duration-200 ease-out"
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
            <div class="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                {post.title}
            </div>
        </div>
    </a>
</li>
