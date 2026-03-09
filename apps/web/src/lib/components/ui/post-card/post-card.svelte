<script lang="ts">
    import { onMount } from 'svelte';
    import type { RecommendedPost } from '$lib/api/types.js';
    import {
        formatNumber,
        getRecommendBadgeClass
    } from '../../features/recommended/utils/index.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';

    let { post }: { post: RecommendedPost } = $props();

    function getBoardId(url: string): string {
        const parts = url.split('/').filter(Boolean);
        return parts[0] || '';
    }

    let showReadState = $state(false);
    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });
    });
</script>

<!-- PHP 원본 list-group-item 스타일 재현 -->
<li>
    <a
        href={post.url}
        rel="external"
        class="hover:bg-muted block rounded px-2 py-1.5 transition-all duration-200 ease-out"
    >
        <div class="flex items-center gap-2">
            <!-- rcmd-box + rcmd-sm 스타일 -->
            <span
                class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                    post.recommend_count
                )}"
            >
                {formatNumber(post.recommend_count)}
            </span>
            <!-- text-truncate -->
            <div
                class="min-w-0 flex-1 truncate text-base leading-relaxed {getReadPostClasses(
                    showReadState && readPostsStore.isRead(getBoardId(post.url), post.id)
                )}"
            >
                {post.title}
            </div>
        </div>
    </a>
</li>
