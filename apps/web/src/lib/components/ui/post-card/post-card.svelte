<script lang="ts">
    import { onMount } from 'svelte';
    import type { RecommendedPost } from '$lib/api/types.js';
    import {
        formatNumber,
        getRecommendBadgeClass
    } from '../../features/recommended/utils/index.js';
    import Eye from '@lucide/svelte/icons/eye';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { getReadPostClasses } from '$lib/stores/read-post-style.svelte.js';
    import { formatCommentCountBadge } from '$lib/utils/comment-count.js';

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

    function formatRelativeTime(dateString: string): string {
        const now = Date.now();
        const date = new Date(dateString).getTime();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return '방금';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;

        return new Date(dateString).toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            month: 'short',
            day: 'numeric'
        });
    }
</script>

<li>
    <a
        href={post.url}
        class="hover:bg-muted flex items-center gap-2.5 px-4 py-2 transition-all duration-200 ease-out"
    >
        <span
            class="inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                post.recommend_count
            )}"
        >
            {formatNumber(post.recommend_count)}
        </span>
        <span
            class="bg-muted text-muted-foreground hidden shrink-0 rounded px-1.5 py-0.5 text-xs sm:inline-block"
        >
            {post.board_name}
        </span>
        <span
            class="min-w-0 flex-1 truncate leading-relaxed {getReadPostClasses(
                showReadState && readPostsStore.isRead(getBoardId(post.url), post.id)
            )}"
            style="font-size: var(--recommend-font-size, 1rem)"
        >
            {post.title}
        </span>
        {#if post.comment_count > 0}
            <span class="text-primary shrink-0 text-xs font-medium">
                {formatCommentCountBadge(post.comment_count)}
            </span>
        {/if}
        <span class="text-muted-foreground hidden shrink-0 items-center gap-3 text-xs sm:flex">
            <span class="flex items-center gap-0.5">
                <Eye class="h-3 w-3" />
                {formatNumber(post.view_count)}
            </span>
            <span class="w-14 text-right">
                {formatRelativeTime(post.created_at)}
            </span>
        </span>
    </a>
</li>
