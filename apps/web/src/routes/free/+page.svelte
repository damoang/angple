<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { PageData } from './$types.js';
    import type { FreePost } from '$lib/api/types.js';

    // 스킨 컴포넌트 import
    import CompactSkin from '$lib/components/features/board/skins/compact.svelte';
    import CardSkin from '$lib/components/features/board/skins/card.svelte';
    import DetailedSkin from '$lib/components/features/board/skins/detailed.svelte';

    let { data }: { data: PageData } = $props();

    // 게시판 표시 설정에 따라 스킨 선택
    const listStyle = $derived(data.board?.display_settings?.list_style || 'compact');

    // 스킨 컴포넌트 매핑
    type SkinComponent = typeof CompactSkin | typeof CardSkin | typeof DetailedSkin;
    const skinComponents: Record<string, SkinComponent> = {
        compact: CompactSkin,
        card: CardSkin,
        detailed: DetailedSkin
    };

    const SkinComponent = $derived(skinComponents[listStyle] || CompactSkin);

    // 카테고리 목록 파싱 (파이프로 구분)
    const categories = $derived(
        data.board?.category_list ? data.board.category_list.split('|').filter((c) => c.trim()) : []
    );

    // 현재 선택된 카테고리 (URL 쿼리에서 가져오기)
    const selectedCategory = $derived($page.url.searchParams.get('category') || '전체');

    // 카테고리 필터링된 게시글
    const filteredPosts = $derived(
        selectedCategory === '전체'
            ? data.posts
            : data.posts.filter((post) => post.category === selectedCategory)
    );

    // 카테고리 변경
    function changeCategory(category: string): void {
        const url = new URL(window.location.href);
        if (category === '전체') {
            url.searchParams.delete('category');
        } else {
            url.searchParams.set('category', category);
        }
        url.searchParams.set('page', '1'); // 카테고리 변경 시 1페이지로 이동
        goto(url.pathname + url.search);
    }

    // 페이지 이동
    function goToPage(page: number): void {
        goto(`/free?page=${page}&limit=${data.pagination.limit}`);
    }

    // 게시글 상세 페이지로 이동
    function goToPost(id: number): void {
        goto(`/free/${id}`);
    }
</script>

<svelte:head>
    <title>자유게시판 | 다모앙</title>
</svelte:head>

<div class="mx-auto pt-4">
    <!-- 헤더 -->
    <div class="mb-8">
        <h1 class="text-foreground mb-2 text-3xl font-bold">자유게시판</h1>
        <p class="text-secondary-foreground">다모앙 커뮤니티의 자유로운 소통 공간입니다.</p>
    </div>

    <!-- 카테고리 탭 -->
    {#if categories.length > 0}
        <div class="mb-6 flex flex-wrap gap-2">
            <Badge
                variant={selectedCategory === '전체' ? 'default' : 'outline'}
                class="cursor-pointer rounded-full px-4 py-2 text-sm"
                onclick={() => changeCategory('전체')}
            >
                전체
            </Badge>
            {#each categories as category (category)}
                <Badge
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    class="cursor-pointer rounded-full px-4 py-2 text-sm"
                    onclick={() => changeCategory(category)}
                >
                    {category}
                </Badge>
            {/each}
        </div>
    {/if}

    <!-- 에러 메시지 -->
    {#if data.error}
        <Card class="border-destructive mb-6">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{data.error}</p>
            </CardContent>
        </Card>
    {/if}

    <!-- 게시글 목록 -->
    <div class="space-y-0">
        {#if filteredPosts.length === 0}
            <Card class="bg-background">
                <CardContent class="py-12 text-center">
                    <p class="text-secondary-foreground">게시글이 없습니다.</p>
                </CardContent>
            </Card>
        {:else}
            {#each filteredPosts as post (post.id)}
                <SkinComponent {post} onclick={() => goToPost(post.id)} />
            {/each}
        {/if}
    </div>

    <!-- 페이지네이션 -->
    {#if data.pagination.totalPages > 1}
        <div class="mt-8 flex items-center justify-center gap-2">
            <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page === 1}
                onclick={() => goToPage(data.pagination.page - 1)}
            >
                이전
            </Button>

            {#each Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                const startPage = Math.max(1, data.pagination.page - 2);
                return startPage + i;
            }) as pageNum (pageNum)}
                {#if pageNum <= data.pagination.totalPages}
                    <Button
                        variant={pageNum === data.pagination.page ? 'default' : 'outline'}
                        size="sm"
                        onclick={() => goToPage(pageNum)}
                    >
                        {pageNum}
                    </Button>
                {/if}
            {/each}

            <Button
                variant="outline"
                size="sm"
                disabled={data.pagination.page === data.pagination.totalPages}
                onclick={() => goToPage(data.pagination.page + 1)}
            >
                다음
            </Button>
        </div>

        <p class="text-secondary-foreground mt-4 text-center text-sm">
            전체 {data.pagination.total.toLocaleString()}개 중 {data.pagination.page} / {data
                .pagination.totalPages} 페이지
        </p>
    {/if}
</div>
