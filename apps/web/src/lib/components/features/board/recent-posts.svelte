<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { apiClient } from '$lib/api/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { layoutRegistry, initCoreLayouts } from './layouts/index.js';
    import CompactLayout from './layouts/list/compact.svelte';

    // 코어 레이아웃 초기화 (중복 호출 안전)
    initCoreLayouts();
    import { PromotionInlinePost } from '$lib/components/ui/promotion-inline-post/index.js';

    interface PromotionPost {
        wrId: number;
        subject: string;
        imageUrl: string;
        linkUrl: string;
        advertiserName: string;
        memberId: string;
        pinToTop: boolean;
        createdAt: string;
    }

    interface Props {
        boardId: string;
        boardTitle: string;
        currentPostId: number;
        limit?: number;
        initialPage?: number;
        promotionPosts?: PromotionPost[];
        displaySettings?: BoardDisplaySettings;
    }

    let {
        boardId,
        boardTitle,
        currentPostId,
        limit = 10,
        initialPage = 1,
        promotionPosts = [],
        displaySettings
    }: Props = $props();

    // 게시판 레이아웃 설정에 따라 레이아웃 컴포넌트 resolve
    const listLayoutId = $derived(displaySettings?.list_layout || 'compact');
    const layoutEntry = $derived(layoutRegistry.resolveList(listLayoutId));
    const LayoutComponent = $derived(layoutEntry?.component || CompactLayout);
    const wrapperClass = $derived(layoutEntry?.manifest.wrapperClass || 'space-y-1');

    // 프로모션 셔플 (매 렌더마다 랜덤)
    let shuffledPromos = $derived.by(() => {
        const arr = [...promotionPosts];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    });
    let posts = $state<FreePost[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 읽은 글 표시 (하이드레이션 깜빡임 방지)
    let showReadState = $state(false);
    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });
    });

    // 페이지네이션
    let currentPage = $state(1);
    let totalPages = $state(1);
    let totalItems = $state(0);

    // 목록 컨테이너 참조
    let listContainer: HTMLElement | undefined = $state();

    // 페이지 변경
    async function goToPage(page: number): Promise<void> {
        if (page < 1 || page > totalPages || page === currentPage) return;

        loading = true;
        try {
            const response = await apiClient.getBoardPosts(boardId, page, limit);
            posts = response.items;
            currentPage = response.page;
            totalPages = response.total_pages;
            totalItems = response.total;

            // 작성자 레벨 배치 로드
            const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
            if (authorIds.length > 0) {
                void memberLevelStore.fetchLevels(authorIds);
            }

            // 목록 영역으로 스크롤 (본문이 다시 보이는 문제 방지)
            if (listContainer) {
                listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (err) {
            console.error('[RecentPosts] 페이지 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    onMount(async () => {
        if (!browser) return;

        try {
            const startPage = Math.max(1, initialPage);
            const response = await apiClient.getBoardPosts(boardId, startPage, limit);
            posts = response.items;
            currentPage = response.page;
            totalPages = response.total_pages;
            totalItems = response.total;

            // 작성자 레벨 배치 로드
            const authorIds = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
            if (authorIds.length > 0) {
                void memberLevelStore.fetchLevels(authorIds);
            }
        } catch (err) {
            console.error('[RecentPosts] 최근글 로드 실패:', err);
            error = '최근글을 불러올 수 없습니다.';
        } finally {
            loading = false;
        }
    });

    // 페이지 번호 배열 계산
    const pageNumbers = $derived(() => {
        const pages: number[] = [];
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, startPage + 4);
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    });
</script>

<!-- 헤더 -->
<div bind:this={listContainer} class="mb-3 flex items-center justify-between">
    <a
        href="/{boardId}"
        class="text-foreground hover:text-primary text-lg font-bold transition-colors"
    >
        {boardTitle}
    </a>
    <a
        href="/{boardId}"
        class="text-muted-foreground hover:text-foreground text-sm transition-colors"
    >
        목록 전체보기 →
    </a>
</div>

{#if loading}
    <!-- 로딩 스켈레톤 -->
    <div class="space-y-1">
        {#each Array(5) as _, i (i)}
            <div class="bg-background rounded-lg border px-4 py-3">
                <div class="bg-muted mb-2 h-4 w-2/3 animate-pulse rounded"></div>
                <div class="bg-muted h-3 w-1/3 animate-pulse rounded"></div>
            </div>
        {/each}
    </div>
{:else if error}
    <div class="py-8 text-center">
        <p class="text-muted-foreground text-sm">{error}</p>
    </div>
{:else if posts.length === 0}
    <div class="py-8 text-center">
        <p class="text-muted-foreground text-sm">최근 글이 없습니다.</p>
    </div>
{:else}
    <div class={wrapperClass}>
        {#each posts as post, i (post.id)}
            <div class={post.id === currentPostId ? 'current-post-highlight' : ''}>
                <LayoutComponent
                    {post}
                    {displaySettings}
                    href="/{boardId}/{post.id}{currentPage > 1 ? `?page=${currentPage}` : ''}"
                    isRead={showReadState && readPostsStore.isRead(boardId, post.id)}
                />
            </div>
            {#if shuffledPromos.length > 0 && i + 1 === 10}
                {#each shuffledPromos.slice(0, 2) as promo (promo.wrId)}
                    <PromotionInlinePost
                        post={promo}
                        variant={listLayoutId === 'classic' ? 'classic' : 'default'}
                    />
                {/each}
            {/if}
        {/each}
    </div>

    <!-- 페이지네이션 -->
    {#if totalPages > 1}
        <div class="mt-4 flex items-center justify-center gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onclick={() => goToPage(currentPage - 1)}
            >
                이전
            </Button>

            {#each pageNumbers() as pageNum (pageNum)}
                <Button
                    variant={pageNum === currentPage ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => goToPage(pageNum)}
                >
                    {pageNum}
                </Button>
            {/each}

            <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onclick={() => goToPage(currentPage + 1)}
            >
                다음
            </Button>
        </div>

        <p class="text-secondary-foreground mt-3 text-center text-sm">
            전체 {totalItems.toLocaleString()}개 중 {currentPage} / {totalPages} 페이지
        </p>
    {/if}
{/if}

<style>
    /* 현재 읽고 있는 글 하이라이트 */
    .current-post-highlight {
        background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
        border-left: 3px solid var(--color-primary);
        border-radius: 0.25rem;
    }
</style>
