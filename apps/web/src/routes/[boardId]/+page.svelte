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
    import Tag from '@lucide/svelte/icons/tag';
    import X from '@lucide/svelte/icons/x';
    import SearchForm from '$lib/components/features/board/search-form.svelte';
    import AdminLayoutSwitcher from '$lib/components/features/board/admin-layout-switcher.svelte';
    import BulkActionsToolbar from '$lib/components/features/board/bulk-actions-toolbar.svelte';
    import CheckSquare from '@lucide/svelte/icons/check-square';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import { DamoangBanner } from '$lib/components/ui/damoang-banner/index.js';
    import { CelebrationRolling } from '$lib/components/ui/celebration-rolling/index.js';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { PromotionInlinePost } from '$lib/components/ui/promotion-inline-post/index.js';
    import { SeoHead, createBreadcrumbJsonLd } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';

    // 특수 게시판 컴포넌트
    import { GivingBoard } from '$lib/components/features/giving/index.js';
    import BoardMapHeader from '$lib/components/features/board/board-map-header.svelte';

    // Board Layout System
    import { layoutRegistry, initCoreLayouts } from '$lib/components/features/board/layouts';

    // 코어 레이아웃 초기화 (최초 1회)
    initCoreLayouts();

    let { data }: { data: PageData } = $props();

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || boardId);

    // 특수 게시판 타입 감지 (board_type 또는 boardId로 판단)
    const boardType = $derived(
        data.board?.board_type ||
            (boardId === 'giving'
                ? 'giving'
                : boardId === 'angtt'
                  ? 'angtt'
                  : boardId === 'angmap'
                    ? 'angmap'
                    : 'standard')
    );
    const isGivingBoard = $derived(boardType === 'giving');
    const isAngmapBoard = $derived(boardType === 'angmap');

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

    // 활성 태그 필터
    const activeTag = $derived(data.activeTag || null);

    // 태그 필터 적용
    function filterByTag(tagName: string): void {
        const url = new URL(window.location.href);
        url.searchParams.set('tag', tagName);
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search);
    }

    // 태그 필터 해제
    function clearTagFilter(): void {
        const url = new URL(window.location.href);
        url.searchParams.delete('tag');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search);
    }

    // 글쓰기 페이지로 이동
    function goToWrite(): void {
        goto(`/${boardId}/write`);
    }

    // 관리자 여부 (레벨 10 이상)
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);

    // 일괄 선택 모드 (관리자 전용)
    let bulkSelectMode = $state(false);
    let selectedPostIds = $state<number[]>([]);

    function toggleBulkSelect(): void {
        bulkSelectMode = !bulkSelectMode;
        if (!bulkSelectMode) selectedPostIds = [];
    }

    function togglePostSelection(postId: number): void {
        if (selectedPostIds.includes(postId)) {
            selectedPostIds = selectedPostIds.filter((id) => id !== postId);
        } else {
            selectedPostIds = [...selectedPostIds, postId];
        }
    }

    function selectAllVisible(): void {
        selectedPostIds = filteredPosts.map((p) => p.id);
    }

    function clearSelection(): void {
        selectedPostIds = [];
    }

    function handleBulkActionComplete(): void {
        // 페이지 리로드로 데이터 갱신
        window.location.reload();
    }

    // 게시판 표시 설정에 따라 레이아웃 선택 (list_layout → list_style 폴백)
    const listLayoutId = $derived(
        data.board?.display_settings?.list_layout ||
            data.board?.display_settings?.list_style ||
            'compact'
    );

    // Layout Registry에서 resolve (Plugin > Theme > Core)
    const layoutEntry = $derived(layoutRegistry.resolveList(listLayoutId));
    const LayoutComponent = $derived(layoutEntry?.component);
    const wrapperClass = $derived(layoutEntry?.manifest.wrapperClass || 'space-y-1');

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

    // 게시글 작성자 레벨 배치 로드
    $effect(() => {
        const ids = [...new Set(data.posts.map((p) => p.author_id).filter(Boolean))];
        if (ids.length > 0) {
            void memberLevelStore.fetchLevels(ids);
        }
    });

    // 직접홍보 사잇글 삽입 로직
    type MergedItem =
        | { type: 'post'; post: (typeof filteredPosts)[number]; key: string }
        | { type: 'promotion'; promotion: (typeof data.promotionPosts)[number]; key: string };

    const mergedPosts: MergedItem[] = $derived.by(() => {
        const posts = filteredPosts;
        if (posts.length < 3 || !data.promotionPosts || data.promotionPosts.length === 0) {
            return posts.map((p) => ({ type: 'post' as const, post: p, key: `post-${p.id}` }));
        }

        // 이미지 있는 홍보글 필터 → 셔플 → 최대 2개
        const withImage = data.promotionPosts.filter((p: { imageUrl: string }) => p.imageUrl);
        const shuffled = [...withImage].sort(() => Math.random() - 0.5);
        const maxPromo = posts.length < 5 ? 1 : 2;
        const promos = shuffled.slice(0, maxPromo);

        if (promos.length === 0) {
            return posts.map((p) => ({ type: 'post' as const, post: p, key: `post-${p.id}` }));
        }

        // 삽입 위치: index 2 ~ (length-1) 사이에서 랜덤, 최소 3칸 간격
        const maxIdx = posts.length - 1;
        const minIdx = 2;
        const positions: number[] = [];

        for (let i = 0; i < promos.length; i++) {
            let attempts = 0;
            while (attempts < 50) {
                const pos = minIdx + Math.floor(Math.random() * (maxIdx - minIdx + 1));
                const tooClose = positions.some((p) => Math.abs(p - pos) < 3);
                if (!tooClose) {
                    positions.push(pos);
                    break;
                }
                attempts++;
            }
            // 50회 시도 후 실패하면 삽입 포기
        }

        positions.sort((a, b) => a - b);

        const result: MergedItem[] = [];
        let promoIdx = 0;

        for (let i = 0; i < posts.length; i++) {
            if (promoIdx < positions.length && i === positions[promoIdx]) {
                result.push({
                    type: 'promotion',
                    promotion: promos[promoIdx],
                    key: `promo-${promos[promoIdx].wrId}`
                });
                promoIdx++;
            }
            result.push({ type: 'post', post: posts[i], key: `post-${posts[i].id}` });
        }

        return result;
    });

    // SEO 설정
    const seoConfig: SeoConfig = $derived({
        meta: {
            title: isSearching ? `"${data.searchParams?.query}" 검색 - ${boardTitle}` : boardTitle,
            description: `${boardTitle} 게시판 - 다모앙 커뮤니티`,
            canonicalUrl: `${$page.url.origin}/${boardId}`
        },
        og: {
            title: boardTitle,
            type: 'website',
            url: `${$page.url.origin}/${boardId}`
        },
        jsonLd: [
            createBreadcrumbJsonLd([
                { name: '홈', url: $page.url.origin },
                { name: boardTitle, url: `${$page.url.origin}/${boardId}` }
            ])
        ]
    });

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

<!-- 나눔 게시판: 전용 탭 기반 UI -->
{#if isGivingBoard}
    <GivingBoard {data} />
{:else}
    <SeoHead config={seoConfig} />

    <div class="mx-auto pt-4">
        <!-- 최상단 배너 (title 위) -->
        <div class="mb-4">
            <DamoangBanner position="board-list" showCelebration={false} height="90px" />
        </div>

        <!-- 앙지도 헤더 -->
        {#if isAngmapBoard}
            <BoardMapHeader />
        {/if}

        <!-- 헤더 -->
        <div class="mb-4 flex items-start justify-between gap-3">
            <div>
                <div class="flex items-center gap-2">
                    <h1 class="text-xl font-bold sm:text-3xl">
                        <a
                            href="/{boardId}"
                            class="text-foreground hover:text-primary transition-colors"
                        >
                            {boardTitle}
                        </a>
                    </h1>
                    {#if isAdmin}
                        <AdminLayoutSwitcher {boardId} currentLayout={listLayoutId} />
                        <Button
                            variant={bulkSelectMode ? 'default' : 'outline'}
                            size="sm"
                            onclick={toggleBulkSelect}
                            class="h-8"
                        >
                            <CheckSquare class="mr-1 h-4 w-4" />
                            선택
                        </Button>
                    {/if}
                </div>
            </div>

            <!-- 축하메시지 롤링 -->
            <div class="flex min-w-0 flex-1 items-center">
                <CelebrationRolling class="w-full" />
            </div>

            {#if canWrite()}
                <Button onclick={goToWrite} class="shrink-0">
                    <Pencil class="mr-2 h-4 w-4" />
                    글쓰기
                </Button>
            {:else if authStore.isAuthenticated}
                <!-- 로그인했지만 권한 부족 -->
                <Button
                    disabled
                    class="shrink-0 cursor-not-allowed opacity-60"
                    title={writePermissionMessage()}
                >
                    <Lock class="mr-2 h-4 w-4" />
                    글쓰기
                </Button>
            {/if}
        </div>

        <!-- 검색 폼 -->
        <div class="mb-3">
            <SearchForm boardPath={`/${boardId}`} />
        </div>

        <!-- 검색 폼 아래 GAM 광고 -->
        <div class="mb-4">
            <AdSlot position="board-head" height="90px" />
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

        <!-- 활성 태그 필터 -->
        {#if activeTag}
            <div class="mb-4 flex items-center gap-2">
                <Tag class="text-muted-foreground h-4 w-4" />
                <Badge variant="default" class="gap-1 rounded-full px-3 py-1">
                    #{activeTag}
                    <button onclick={clearTagFilter} class="ml-1 rounded-full hover:bg-white/20">
                        <X class="h-3 w-3" />
                    </button>
                </Badge>
                <span class="text-muted-foreground text-sm">태그 필터 적용 중</span>
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

        <!-- 일괄 작업 툴바 (관리자 선택 모드) -->
        {#if bulkSelectMode}
            <div class="mb-3">
                <BulkActionsToolbar
                    {boardId}
                    selectedIds={selectedPostIds}
                    onClearSelection={clearSelection}
                    onActionComplete={handleBulkActionComplete}
                />
                {#if selectedPostIds.length === 0}
                    <div class="mt-2 flex items-center gap-2">
                        <Button variant="ghost" size="sm" onclick={selectAllVisible}>
                            현재 페이지 전체 선택
                        </Button>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- 게시글 목록 (레이아웃별 래퍼 클래스 적용) -->
        <div class={wrapperClass}>
            {#if filteredPosts.length === 0}
                <Card class="bg-background {listLayoutId === 'gallery' ? 'col-span-full' : ''}">
                    <CardContent class="py-12 text-center">
                        {#if isSearching}
                            <p class="text-secondary-foreground">검색 결과가 없습니다.</p>
                        {:else}
                            <p class="text-secondary-foreground">게시글이 없습니다.</p>
                        {/if}
                    </CardContent>
                </Card>
            {:else if LayoutComponent}
                {#each mergedPosts as item (item.key)}
                    {#if item.type === 'promotion'}
                        <PromotionInlinePost post={item.promotion} />
                    {:else if bulkSelectMode}
                        <div class="flex items-start gap-2">
                            <div class="flex shrink-0 items-center pt-3">
                                <Checkbox
                                    checked={selectedPostIds.includes(item.post.id)}
                                    onCheckedChange={() => togglePostSelection(item.post.id)}
                                />
                            </div>
                            <div class="min-w-0 flex-1">
                                <LayoutComponent
                                    post={item.post}
                                    displaySettings={data.board?.display_settings}
                                    onclick={() => goToPost(item.post.id)}
                                />
                            </div>
                        </div>
                    {:else}
                        <LayoutComponent
                            post={item.post}
                            displaySettings={data.board?.display_settings}
                            onclick={() => goToPost(item.post.id)}
                        />
                    {/if}
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

            <!-- 페이지네이션 아래 GAM 광고 -->
            <div class="mt-6">
                <AdSlot position="board-list-bottom" height="90px" />
            </div>
        {/if}
    </div>
{/if}
