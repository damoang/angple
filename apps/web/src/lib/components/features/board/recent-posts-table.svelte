<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { apiClient } from '$lib/api/index.js';
    import type { FreePost } from '$lib/api/types.js';
    import Lock from '@lucide/svelte/icons/lock';
    import { Badge } from '$lib/components/ui/badge/index.js';

    interface Props {
        boardId: string;
        boardTitle: string;
        currentPostId: number;
        limit?: number;
    }

    let { boardId, boardTitle, currentPostId, limit = 10 }: Props = $props();
    let posts = $state<FreePost[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 상대 시간 포맷 (예: "3시간 전", "1일 전")
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 7) {
            return date.toLocaleDateString('ko-KR', {
                month: 'short',
                day: 'numeric'
            });
        } else if (days > 0) {
            return `${days}일 전`;
        } else if (hours > 0) {
            return `${hours}시간 전`;
        } else if (minutes > 0) {
            return `${minutes}분 전`;
        } else {
            return '방금 전';
        }
    }

    onMount(async () => {
        if (!browser) return;

        try {
            // 현재 글 제외를 위해 limit + 1 개 요청
            const response = await apiClient.getBoardPosts(boardId, 1, limit + 1);
            // 현재 글 제외하고 limit 개만 표시
            posts = response.items.filter((p) => p.id !== currentPostId).slice(0, limit);
        } catch (err) {
            console.error('[RecentPosts] 최근글 로드 실패:', err);
            error = '최근글을 불러올 수 없습니다.';
        } finally {
            loading = false;
        }
    });
</script>

<!--
    RecentPosts 테이블 형식 (백업용)
    - 번호, 제목, 작성자, 조회수, 추천, 날짜 형태
    - 심플한 리스트 스타일
-->
<div class="bg-card border-border rounded-xl border">
    <!-- 헤더 -->
    <div class="border-border flex items-center justify-between border-b px-4 py-3">
        <h3 class="text-foreground flex items-center gap-2 font-semibold">
            <span class="text-primary">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M7 7h10" />
                    <path d="M7 12h10" />
                    <path d="M7 17h10" />
                </svg>
            </span>
            {boardTitle} 최근글
        </h3>
        <a
            href="/{boardId}"
            class="text-muted-foreground hover:text-primary text-xs transition-colors"
        >
            더보기 →
        </a>
    </div>

    {#if loading}
        <!-- 로딩 스켈레톤 -->
        <div class="divide-border divide-y">
            {#each Array(5) as _, i (i)}
                <div class="flex items-center gap-4 px-4 py-2.5">
                    <div class="bg-muted h-4 flex-1 animate-pulse rounded"></div>
                    <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
                    <div class="bg-muted h-4 w-12 animate-pulse rounded"></div>
                </div>
            {/each}
        </div>
    {:else if error}
        <div class="px-4 py-8 text-center">
            <p class="text-muted-foreground text-sm">{error}</p>
        </div>
    {:else if posts.length === 0}
        <div class="px-4 py-8 text-center">
            <p class="text-muted-foreground text-sm">최근 글이 없습니다.</p>
        </div>
    {:else}
        <!-- 목록 테이블 -->
        <div class="divide-border divide-y">
            {#each posts as post, index (post.id)}
                <a
                    href="/{boardId}/{post.id}"
                    class="hover:bg-accent group flex items-center gap-2 px-4 py-2.5 transition-colors"
                >
                    <!-- 번호 -->
                    <span class="text-muted-foreground w-6 shrink-0 text-center text-xs">
                        {index + 1}
                    </span>

                    <!-- 제목 -->
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                            {#if post.category}
                                <span
                                    class="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                >
                                    {post.category}
                                </span>
                            {/if}
                            {#if post.is_adult}
                                <Badge variant="destructive" class="shrink-0 px-1 py-0 text-[10px]">
                                    19
                                </Badge>
                            {/if}
                            {#if post.is_secret}
                                <Lock class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            {/if}
                            <span
                                class="text-foreground group-hover:text-primary truncate text-sm transition-colors"
                            >
                                {post.title}
                            </span>
                            {#if post.comments_count > 0}
                                <span class="text-primary shrink-0 text-xs font-medium">
                                    [{post.comments_count}]
                                </span>
                            {/if}
                        </div>
                    </div>

                    <!-- 작성자 -->
                    <span
                        class="text-muted-foreground hidden w-20 shrink-0 truncate text-xs sm:block"
                    >
                        {post.author}
                    </span>

                    <!-- 조회수 -->
                    <span
                        class="text-muted-foreground hidden w-12 shrink-0 text-right text-xs sm:block"
                    >
                        {post.views.toLocaleString()}
                    </span>

                    <!-- 추천수 -->
                    <span class="text-primary w-8 shrink-0 text-right text-xs font-medium">
                        {#if post.likes > 0}
                            👍{post.likes}
                        {/if}
                    </span>

                    <!-- 날짜 -->
                    <span class="text-muted-foreground w-14 shrink-0 text-right text-xs">
                        {formatDate(post.created_at)}
                    </span>
                </a>
            {/each}
        </div>
    {/if}
</div>
