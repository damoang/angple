<script lang="ts">
    import type { EmpathyComment } from '$lib/api/types.js';
    import {
        formatNumber,
        getRecommendBadgeClass
    } from '../../features/empathy/utils/index.js';

    function stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '').trim();
    }

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

    let { comment }: { comment: EmpathyComment } = $props();
</script>

<li>
    <a
        href={comment.url}
        class="hover:bg-muted block px-4 py-2.5 transition-all duration-200 ease-out"
    >
        <div class="flex items-start gap-2.5">
            <span
                class="mt-0.5 inline-flex min-w-[2.5rem] flex-shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold {getRecommendBadgeClass(
                    comment.recommend_count
                )}"
            >
                {formatNumber(comment.recommend_count)}
            </span>
            <div class="min-w-0 flex-1">
                <p
                    class="text-muted-foreground flex items-center gap-1.5 truncate text-xs"
                    title={comment.parent_title}
                >
                    <span class="bg-muted shrink-0 rounded px-1 py-0.5 text-[10px]">
                        {comment.board_name}
                    </span>
                    <span class="truncate">{comment.parent_title}</span>
                </p>
                <p
                    class="mt-0.5 line-clamp-2 text-sm leading-relaxed"
                    style="font-size: var(--recommend-font-size, 0.9rem)"
                >
                    {stripHtml(comment.content)}
                </p>
                <span class="text-muted-foreground mt-1 text-xs">
                    {formatRelativeTime(comment.created_at)}
                </span>
            </div>
        </div>
    </a>
</li>
