<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import CircleCheck from '@lucide/svelte/icons/circle-check';
    import CircleHelp from '@lucide/svelte/icons/circle-help';
    import Coins from '@lucide/svelte/icons/coins';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import type { FreePost } from '$lib/api/types.js';
    import { parseQAInfo, getQAStatusLabel, getQAStatusColor } from '$lib/types/qa-board.js';

    interface Props {
        boardId: string;
        boardTitle: string;
    }

    let { boardId, boardTitle }: Props = $props();

    let posts = $state<FreePost[]>([]);
    let totalPages = $state(1);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // URL에서 필터/페이지 파싱
    const currentFilter = $derived($page.url.searchParams.get('filter') || 'all');
    const currentPage = $derived(Number($page.url.searchParams.get('page')) || 1);

    const filters = [
        { id: 'all', label: '전체' },
        { id: 'unanswered', label: '미해결' },
        { id: 'answered', label: '답변됨' },
        { id: 'solved', label: '해결됨' }
    ];

    // 게시글 로드
    async function loadPosts(): Promise<void> {
        isLoading = true;
        error = null;

        try {
            const result = await apiClient.getBoardPosts(boardId, currentPage, 20);
            let allPosts = result.items;

            // 클라이언트 사이드 필터링 (백엔드 API가 extra_1 필터를 지원하지 않으므로)
            if (currentFilter !== 'all') {
                allPosts = allPosts.filter((p) => {
                    const qa = parseQAInfo(p);
                    return qa.status === currentFilter;
                });
            }

            posts = allPosts;
            totalPages = result.total_pages;
        } catch {
            error = '게시글을 불러오지 못했습니다.';
        } finally {
            isLoading = false;
        }
    }

    // 필터/페이지 변경 시 자동 로드
    $effect(() => {
        void currentFilter;
        void currentPage;
        loadPosts();
    });

    function changeFilter(filter: string): void {
        goto(`/${boardId}?filter=${filter}`, { replaceState: true });
    }

    function goToPage(pageNum: number): void {
        goto(`/${boardId}?filter=${currentFilter}&page=${pageNum}`, { replaceState: true });
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    }
</script>

<div class="space-y-4">
    <!-- 헤더 -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
            <CircleHelp class="h-6 w-6" />
            <h1 class="text-foreground text-2xl font-bold">{boardTitle}</h1>
        </div>
        {#if authStore.isAuthenticated}
            <Button onclick={() => goto(`/${boardId}/write`)}>질문하기</Button>
        {/if}
    </div>

    <!-- 필터 탭 -->
    <div class="flex gap-2">
        {#each filters as filter (filter.id)}
            <Button
                variant={currentFilter === filter.id ? 'default' : 'outline'}
                size="sm"
                onclick={() => changeFilter(filter.id)}
            >
                {filter.label}
            </Button>
        {/each}
    </div>

    <!-- 에러 -->
    {#if error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{error}</p>
            </CardContent>
        </Card>
    {/if}

    <!-- 로딩 -->
    {#if isLoading}
        <div class="text-muted-foreground py-12 text-center">로딩 중...</div>
    {:else if posts.length === 0}
        <Card>
            <CardContent class="pt-6">
                <p class="text-muted-foreground py-8 text-center">
                    {currentFilter === 'all' ? '아직 질문이 없습니다.' : `${filters.find(f => f.id === currentFilter)?.label} 질문이 없습니다.`}
                </p>
            </CardContent>
        </Card>
    {:else}
        <!-- 질문 목록 -->
        <div class="space-y-2">
            {#each posts as post (post.id)}
                {@const qa = parseQAInfo(post)}
                <a
                    href="/{boardId}/{post.id}"
                    class="bg-card hover:bg-accent/50 border-border flex items-start gap-4 rounded-lg border p-4 transition-colors"
                >
                    <!-- 상태 뱃지 -->
                    <div class="flex flex-col items-center gap-1 pt-1">
                        {#if qa.status === 'solved'}
                            <CircleCheck class="h-5 w-5 text-green-600" />
                        {:else}
                            <CircleHelp class="text-muted-foreground h-5 w-5" />
                        {/if}
                    </div>

                    <!-- 콘텐츠 -->
                    <div class="min-w-0 flex-1">
                        <div class="mb-1 flex items-center gap-2">
                            <Badge class={getQAStatusColor(qa.status)}>
                                {getQAStatusLabel(qa.status)}
                            </Badge>
                            {#if qa.bounty > 0}
                                <Badge variant="outline" class="gap-1">
                                    <Coins class="h-3 w-3" />
                                    {qa.bounty}P
                                </Badge>
                            {/if}
                        </div>
                        <h3 class="text-foreground mb-1 line-clamp-1 font-medium">
                            {post.title}
                        </h3>
                        <div class="text-muted-foreground flex items-center gap-3 text-xs">
                            <span>{post.author}</span>
                            <span>{formatDate(post.created_at)}</span>
                            <span class="flex items-center gap-1">
                                <MessageSquare class="h-3 w-3" />
                                {post.comments_count}
                            </span>
                            <span>조회 {post.views}</span>
                        </div>
                        {#if post.tags && post.tags.length > 0}
                            <div class="mt-2 flex flex-wrap gap-1">
                                {#each post.tags as tag (tag)}
                                    <Badge variant="secondary" class="text-xs">#{tag}</Badge>
                                {/each}
                            </div>
                        {/if}
                    </div>
                </a>
            {/each}
        </div>

        <!-- 페이지네이션 -->
        {#if totalPages > 1}
            <div class="mt-6 flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onclick={() => goToPage(currentPage - 1)}
                >
                    이전
                </Button>
                <span class="text-muted-foreground px-4 text-sm">
                    {currentPage} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onclick={() => goToPage(currentPage + 1)}
                >
                    다음
                </Button>
            </div>
        {/if}
    {/if}
</div>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        line-clamp: 1;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
