<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { PageData } from './$types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Lock from '@lucide/svelte/icons/lock';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import Pin from '@lucide/svelte/icons/pin';
    import SearchForm from '$lib/components/features/board/search-form.svelte';

    // 스킨 컴포넌트 import
    import CompactSkin from '$lib/components/features/board/skins/compact.svelte';
    import CardSkin from '$lib/components/features/board/skins/card.svelte';
    import DetailedSkin from '$lib/components/features/board/skins/detailed.svelte';

    let { data }: { data: PageData } = $props();

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || boardId);

    // 글쓰기 권한 체크
    // 1. 서버에서 계산된 permissions.can_write 사용 (인증된 경우)
    // 2. permissions가 없으면 클라이언트에서 레벨 비교 (하위호환)
    const canWrite = $derived(() => {
        if (!authStore.isAuthenticated) return false;
        // 서버에서 계산된 권한 정보가 있으면 사용
        if (data.board?.permissions) {
            return data.board.permissions.can_write;
        }
        // 하위호환: 클라이언트에서 레벨 비교
        const userLevel = authStore.user?.mb_level ?? 1;
        const requiredLevel = data.board?.write_level ?? 1;
        return userLevel >= requiredLevel;
    });

    // 권한 부족 시 표시할 메시지
    const writePermissionMessage = $derived(() => {
        if (!authStore.isAuthenticated) return '로그인이 필요합니다';
        const requiredLevel = data.board?.write_level ?? 1;
        return `레벨 ${requiredLevel} 이상 작성 가능`;
    });

    // 공지사항 분류
    const importantNotices = $derived(
        (data.notices || []).filter((n) => n.notice_type === 'important')
    );
    const normalNotices = $derived(
        (data.notices || []).filter((n) => n.notice_type !== 'important')
    );
    const hasNotices = $derived(data.notices && data.notices.length > 0);

    // 검색 중인지 여부
    const isSearching = $derived(Boolean(data.searchParams));

    // 글쓰기 페이지로 이동
    function goToWrite(): void {
        goto(`/${boardId}/write`);
    }

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
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search);
    }

    // 페이지 이동 (검색 파라미터 유지)
    function goToPage(pageNum: number): void {
        const url = new URL(window.location.href);
        url.searchParams.set('page', String(pageNum));
        goto(url.pathname + url.search);
    }

    // 게시글 상세 페이지로 이동
    function goToPost(id: number): void {
        goto(`/${boardId}/${id}`);
    }
</script>

<svelte:head>
    <title>{isSearching ? `"${data.searchParams?.query}" 검색 - ` : ''}{boardTitle} | 다모앙</title>
</svelte:head>

<div class="mx-auto pt-4">
    <!-- 헤더 -->
    <div class="mb-8 flex items-start justify-between">
        <div>
            <h1 class="text-foreground mb-2 text-3xl font-bold">{boardTitle}</h1>
        </div>
        {#if canWrite}
            <Button onclick={goToWrite} class="shrink-0">
                <Pencil class="mr-2 h-4 w-4" />
                글쓰기
            </Button>
        {:else if authStore.isAuthenticated}
            <!-- 로그인했지만 권한 부족 -->
            <Button
                disabled
                class="shrink-0 cursor-not-allowed opacity-60"
                title={writePermissionMessage}
            >
                <Lock class="mr-2 h-4 w-4" />
                글쓰기
            </Button>
        {/if}
    </div>

    <!-- 검색 폼 -->
    <div class="mb-6">
        <SearchForm boardPath={`/${boardId}`} />
    </div>

    <!-- 카테고리 탭 -->
    {#if categories.length > 0 && !isSearching}
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

    <!-- 공지사항 (검색 중이 아닐 때만 표시) -->
    {#if hasNotices && !isSearching}
        <div class="mb-4 space-y-1">
            <!-- 필수 공지 -->
            {#each importantNotices as notice (notice.id)}
                <div
                    class="bg-destructive/5 border-destructive/20 hover:bg-destructive/10 cursor-pointer rounded-lg border px-4 py-3 transition-colors"
                    onclick={() => goToPost(notice.id)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => e.key === 'Enter' && goToPost(notice.id)}
                >
                    <div class="flex items-center gap-3">
                        <div class="flex shrink-0 items-center gap-1.5">
                            <Megaphone class="text-destructive h-4 w-4" />
                            <Badge variant="destructive" class="text-xs">필수</Badge>
                        </div>
                        <h3 class="text-foreground flex-1 truncate font-medium">
                            {notice.title}
                        </h3>
                        <span class="text-muted-foreground shrink-0 text-xs">
                            {notice.author}
                        </span>
                    </div>
                </div>
            {/each}

            <!-- 일반 공지 -->
            {#each normalNotices as notice (notice.id)}
                <div
                    class="bg-muted/50 border-border hover:bg-muted cursor-pointer rounded-lg border px-4 py-3 transition-colors"
                    onclick={() => goToPost(notice.id)}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) => e.key === 'Enter' && goToPost(notice.id)}
                >
                    <div class="flex items-center gap-3">
                        <div class="flex shrink-0 items-center gap-1.5">
                            <Pin class="text-muted-foreground h-4 w-4" />
                            <Badge variant="secondary" class="text-xs">공지</Badge>
                        </div>
                        <h3 class="text-foreground flex-1 truncate font-medium">
                            {notice.title}
                        </h3>
                        <span class="text-muted-foreground shrink-0 text-xs">
                            {notice.author}
                        </span>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    <!-- 게시글 목록 -->
    <div class="space-y-1">
        {#if filteredPosts.length === 0}
            <Card class="bg-background">
                <CardContent class="py-12 text-center">
                    {#if isSearching}
                        <p class="text-secondary-foreground">검색 결과가 없습니다.</p>
                    {:else}
                        <p class="text-secondary-foreground">게시글이 없습니다.</p>
                    {/if}
                </CardContent>
            </Card>
        {:else}
            {#each filteredPosts as post (post.id)}
                <SkinComponent
                    {post}
                    displaySettings={data.board?.display_settings}
                    onclick={() => goToPost(post.id)}
                />
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
            {isSearching ? '검색결과 ' : '전체 '}{data.pagination.total.toLocaleString()}개 중 {data
                .pagination.page} / {data.pagination.totalPages} 페이지
        </p>
    {/if}
</div>
