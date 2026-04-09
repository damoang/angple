<script lang="ts" module>
    import type { Snapshot } from './$types.js';

    // 뒤로가기 시 스크롤 위치 즉시 복원 (서버 재요청 대기 중에도 이전 위치 유지)
    export const snapshot: Snapshot<{ scrollY: number }> = {
        capture: () => ({ scrollY: window.scrollY }),
        restore: (value) => {
            // 데이터 로드 + 렌더링 완료까지 점진적으로 스크롤 복원 시도
            const scrollTo = () => window.scrollTo(0, value.scrollY);
            requestAnimationFrame(scrollTo);
            setTimeout(() => requestAnimationFrame(scrollTo), 100);
            setTimeout(() => requestAnimationFrame(scrollTo), 300);
        }
    };
</script>

<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { PageData } from './$types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import {
        canUseCertifiedAction,
        getCertificationBlockedMessage,
        goToCertification
    } from '$lib/utils/certification-gate.js';
    import { slide } from 'svelte/transition';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Lock from '@lucide/svelte/icons/lock';
    import Search from '@lucide/svelte/icons/search';
    import Megaphone from '@lucide/svelte/icons/megaphone';
    import Pin from '@lucide/svelte/icons/pin';
    import Tag from '@lucide/svelte/icons/tag';
    import X from '@lucide/svelte/icons/x';
    import SearchForm from '$lib/components/features/board/search-form.svelte';
    import BulkActionsToolbar from '$lib/components/features/board/bulk-actions-toolbar.svelte';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import { doAction } from '$lib/hooks/registry';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import {
        SeoHead,
        createBreadcrumbJsonLd,
        getSiteUrl,
        getPageSeoConfig
    } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import { checkPermission, getPermissionMessage } from '$lib/utils/board-permissions.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { densityStore } from '$lib/stores/density.svelte.js';
    import { readPostStyleStore, type ReadPostStyle } from '$lib/stores/read-post-style.svelte.js';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import {
        DropdownMenu,
        DropdownMenuContent,
        DropdownMenuTrigger,
        DropdownMenuLabel,
        DropdownMenuSeparator,
        DropdownMenuRadioGroup,
        DropdownMenuRadioItem,
        DropdownMenuCheckboxItem
    } from '$lib/components/ui/dropdown-menu/index.js';
    import Settings2 from '@lucide/svelte/icons/settings-2';

    // 특수 게시판 컴포넌트 (플러그인 레지스트리 기반)
    import { boardTypeRegistry } from '$lib/components/features/board/board-type-registry.js';
    import BoardMapHeader from '$lib/components/features/board/board-map-header.svelte';
    import EconomyShoppingBanner from '$lib/components/features/board/economy-shopping-banner.svelte';
    import TagNav from '$lib/components/ui/tag-nav/tag-nav.svelte';
    import QAPostList from '$lib/components/features/board/qa-post-list.svelte';
    import BoardFavoriteButton from '$lib/components/features/board/board-favorite-button.svelte';
    import BoardSubscribeButton from '$lib/components/features/board/board-subscribe-button.svelte';
    import { Watermark } from '$lib/components/ui/watermark/index.js';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import Trash2 from '@lucide/svelte/icons/trash-2';

    // Q&A 게시판 타입 등록
    boardTypeRegistry.register('qa', QAPostList, 'core');

    // Board Layout System
    import { layoutRegistry, initCoreLayouts } from '$lib/components/features/board/layouts';
    // 코어 레이아웃 초기화 (최초 1회)
    initCoreLayouts();

    let { data }: { data: PageData } = $props();
    let promotionPosts = $state<unknown[]>(data.promotionData || []);

    // 게시판 정보
    const boardId = $derived(data.boardId);
    // subject(프론트엔드 타입) 또는 name(백엔드 API 응답) 사용
    const boardTitle = $derived(data.board?.subject || data.board?.name || boardId);

    // 특수 게시판 타입 감지 (board_type 또는 boardId로 판단)
    const boardType = $derived(
        data.board?.board_type ||
            (boardId === 'giving'
                ? 'giving'
                : boardId === 'angtt'
                  ? 'angtt'
                  : boardId === 'angmap'
                    ? 'angmap'
                    : boardId === 'economy'
                      ? 'economy'
                      : 'standard')
    );
    $effect(() => {
        if (boardType !== 'giving') return;
        const p = '../../../../../plugins/giving/hooks/register-layouts.js';
        // @ts-ignore
        import(p).then((m: { default: () => void }) => m.default()).catch(() => {});
    });
    const isAngmapBoard = $derived(boardType === 'angmap');
    const isEconomyBoard = $derived(boardType === 'economy');

    // 플러그인 레지스트리에서 특수 게시판 컴포넌트 resolve
    const boardTypeComponent = $derived(boardTypeRegistry.resolve(boardType));

    // 목록 보기 권한 체크 (list_level이 0보다 크고 인증된 경우에만 체크)
    const canList = $derived.by(() => {
        if (!authStore.isAuthenticated) {
            // 비회원 레벨=1, list_level<=1이면 공개 게시판
            const requiredLevel = data.board?.list_level ?? 1;
            return requiredLevel <= 1;
        }
        return checkPermission(data.board, 'can_list', authStore.user ?? null);
    });
    const listPermissionMessage = $derived(
        getPermissionMessage(data.board, 'can_list', authStore.user ?? null)
    );

    // 글쓰기 권한 체크 (서버 permissions 우선, 클라이언트 레벨 비교 폴백)
    // claim 게시판은 직접 글쓰기 불가 (이용제한 상세에서만 소명 작성 가능)
    const canWrite = $derived.by(() => {
        if (!authStore.isAuthenticated) return false;
        if (boardId === 'claim') return false;
        return checkPermission(data.board, 'can_write', authStore.user ?? null);
    });

    // 권한 부족 시 표시할 메시지
    const writePermissionMessage = $derived.by(() => {
        if (!authStore.isAuthenticated) return '로그인이 필요합니다';
        return getPermissionMessage(data.board, 'can_write', authStore.user ?? null);
    });

    // 검색 중인지 여부
    const isSearching = $derived(Boolean(data.searchParams));

    // 현재 페이지 번호 (글 링크에 전달용)
    const listPage = $derived(Number($page.url.searchParams.get('page')) || 1);

    // 읽은 글 표시 지연 — SSR에서는 모든 글이 "안읽음"으로 렌더링되므로,
    // 하이드레이션 직후 즉시 변경하면 깜빡임 발생. 2프레임 대기 후 부드럽게 전환.
    let showSearch = $state(uiSettingsStore.pinSearch);
    let showReadState = $state(false);
    let memoByAuthorId = $state<Record<string, { content: string; color: string } | null>>({});
    let lastMemoRequestKey = $state('');
    let memoScheduleToken: number | ReturnType<typeof setTimeout> | null = null;

    const MEMO_CACHE_TTL_MS = 30_000;
    const memoBatchCache = new Map<
        string,
        {
            expiresAt: number;
            value: Record<string, { content: string; color: string } | null>;
        }
    >();
    const memoBatchPending = new Map<
        string,
        Promise<Record<string, { content: string; color: string } | null>>
    >();

    function clearMemoSchedule(): void {
        if (memoScheduleToken === null || typeof window === 'undefined') return;

        if (typeof memoScheduleToken === 'number' && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(memoScheduleToken);
        } else {
            clearTimeout(memoScheduleToken);
        }
        memoScheduleToken = null;
    }

    function buildMemoState(
        authorIds: string[],
        data: Record<string, { content?: string; color?: string }>
    ): Record<string, { content: string; color: string } | null> {
        const next: Record<string, { content: string; color: string } | null> = {};

        for (const id of authorIds) {
            const memo = data[id];
            next[id] = memo?.content
                ? { content: memo.content, color: memo.color ?? 'yellow' }
                : null;
        }

        return next;
    }

    async function loadBoardListMemos(authorIds: string[]): Promise<void> {
        if (!authStore.isAuthenticated || !pluginStore.isPluginActive('member-memo')) {
            clearMemoSchedule();
            lastMemoRequestKey = '';
            memoByAuthorId = {};
            return;
        }

        const uniqueAuthorIds = [...new Set(authorIds)].filter(Boolean);
        if (uniqueAuthorIds.length === 0) {
            clearMemoSchedule();
            lastMemoRequestKey = '';
            memoByAuthorId = {};
            return;
        }

        const memoKey = uniqueAuthorIds.join(',');
        const cached = memoBatchCache.get(memoKey);
        if (cached && cached.expiresAt > Date.now()) {
            lastMemoRequestKey = memoKey;
            memoByAuthorId = cached.value;
            return;
        }

        const pending = memoBatchPending.get(memoKey);
        if (pending) {
            lastMemoRequestKey = memoKey;
            memoByAuthorId = await pending;
            return;
        }

        const loadPromise = (async () => {
            const response = await fetch(
                `/api/v1/members/batch/memo?ids=${uniqueAuthorIds.map(encodeURIComponent).join(',')}`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                return {};
            }

            const json = await response.json();
            const payload = (json?.data ?? {}) as Record<
                string,
                { content?: string; color?: string }
            >;
            const next = buildMemoState(uniqueAuthorIds, payload);
            memoBatchCache.set(memoKey, {
                expiresAt: Date.now() + MEMO_CACHE_TTL_MS,
                value: next
            });

            return next;
        })();

        memoBatchPending.set(memoKey, loadPromise);

        try {
            const next = await loadPromise;
            lastMemoRequestKey = memoKey;
            memoByAuthorId = next;
        } catch {
            lastMemoRequestKey = '';
            memoByAuthorId = {};
        } finally {
            memoBatchPending.delete(memoKey);
        }
    }

    function scheduleBoardListMemos(authorIds: string[]): void {
        const uniqueAuthorIds = [...new Set(authorIds)].filter(Boolean);
        if (uniqueAuthorIds.length === 0) {
            clearMemoSchedule();
            lastMemoRequestKey = '';
            memoByAuthorId = {};
            return;
        }

        const memoKey = uniqueAuthorIds.join(',');
        if (memoKey === lastMemoRequestKey) {
            return;
        }

        clearMemoSchedule();

        const loadTask = () => {
            void loadBoardListMemos(uniqueAuthorIds);
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            memoScheduleToken = window.requestIdleCallback(loadTask, { timeout: 1500 });
            return;
        }

        memoScheduleToken = globalThis.setTimeout(loadTask, 250);
    }

    onMount(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                showReadState = true;
            });
        });
    });

    // 목록 데이터 반영 시 메모 배치 로드 + 훅 발행
    $effect(() => {
        const result = data.postsData;
        if (!result) return;

        const authorIds = [...result.posts, ...(result.notices || [])]
            .map((p) => p.author_id)
            .filter((id): id is string => Boolean(id));
        const usesInlineListMemo = listLayoutId === 'classic';

        if (usesInlineListMemo) {
            scheduleBoardListMemos(authorIds);
        } else {
            clearMemoSchedule();
            lastMemoRequestKey = '';
            memoByAuthorId = {};
        }

        doAction('board_list_loaded', {
            boardId,
            boardType,
            posts: result.posts,
            notices: result.notices || []
        });
    });

    $effect(() => {
        // SSR에서 직접 포함된 데이터가 있으면 사용 (캐시 warm 시)
        if (data.promotionData && data.promotionData.length > 0) {
            promotionPosts = data.promotionData;
            return;
        }

        // 캐시 cold 시 스트리밍 fallback
        const promise = data.streamed?.promotionData;
        if (!promise) {
            promotionPosts = [];
            return;
        }

        let cancelled = false;

        promise
            .then((result: unknown[]) => {
                if (cancelled) return;
                promotionPosts = result || [];
            })
            .catch(() => {
                if (cancelled) return;
                promotionPosts = [];
            });

        return () => {
            cancelled = true;
        };
    });

    // 활성 태그 필터
    const activeTag = $derived(data.activeTag || null);
    const postsResult = $derived(data.postsData);
    const posts = $derived(postsResult.posts);
    const notices = $derived(postsResult.notices || []);
    const pagination = $derived(postsResult.pagination);
    const paginationHasNext = $derived(pagination.hasNext ?? false);
    const paginationTotalPages = $derived(pagination.totalPages ?? 0);
    const shouldShowPagination = $derived(
        paginationHasNext || pagination.page > 1 || paginationTotalPages > 1
    );
    const visiblePageNumbers = $derived.by(() => {
        if (paginationTotalPages > 0) {
            const startPage = Math.max(1, pagination.page - 2);
            const endPage = Math.min(paginationTotalPages, startPage + 4);
            return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
        }

        if (paginationHasNext) {
            const startPage = Math.max(1, pagination.page - 2);
            return Array.from({ length: 5 }, (_, i) => startPage + i);
        }

        const startPage = Math.max(1, pagination.page - 4);
        return Array.from({ length: pagination.page - startPage + 1 }, (_, i) => startPage + i);
    });
    const filteredPosts = $derived(posts);
    const importantNotices = $derived(
        notices.filter(
            (n) =>
                n.notice_type === 'important' &&
                !(uiSettingsStore.hideReadNotices && readPostsStore.isRead(boardId, n.id))
        )
    );
    const normalNotices = $derived(
        notices.filter(
            (n) =>
                n.notice_type !== 'important' &&
                !(uiSettingsStore.hideReadNotices && readPostsStore.isRead(boardId, n.id))
        )
    );
    const hasNotices = $derived(importantNotices.length > 0 || normalNotices.length > 0);
    const shuffledPromos = $derived.by(() => {
        const arr = [...promotionPosts];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    });

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
        if (!canUseCertifiedAction(authStore.user, boardId)) {
            goToCertification();
            return;
        }
        goto(`/${boardId}/write`);
    }

    // 일괄 선택 모드
    let bulkSelectMode = $state(false);
    let selectedPostIds = $state<number[]>([]);

    function togglePostSelection(postId: number): void {
        if (selectedPostIds.includes(postId)) {
            selectedPostIds = selectedPostIds.filter((id) => id !== postId);
        } else {
            selectedPostIds = [...selectedPostIds, postId];
        }
    }

    function selectAllVisible(posts: any[]): void {
        selectedPostIds = posts.map((p) => p.id);
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
            'classic'
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

    // SEO 설정 (board 정보만 사용 → 즉시 렌더링)
    const seoConfig: SeoConfig = $derived.by(() => {
        const siteUrl = getSiteUrl();
        const baseUrl = `${siteUrl}/${boardId}`;
        const currentPage = Number($page.url.searchParams.get('page')) || 1;

        const currentUrl = new URL($page.url.href);
        const pageSeo = getPageSeoConfig(currentUrl, currentPage, 1, siteUrl);

        return {
            meta: {
                title: isSearching
                    ? `"${data.searchParams?.query}" 검색 - ${boardTitle}`
                    : currentPage > 1
                      ? `${boardTitle} - ${currentPage}페이지`
                      : boardTitle,
                description: `${boardTitle} 게시판 - ${import.meta.env.VITE_SITE_NAME || 'Angple'}`,
                canonicalUrl: pageSeo.canonical,
                noIndex: pageSeo.noIndex,
                noFollow: pageSeo.noFollow
            },
            og: {
                title: boardTitle,
                type: 'website',
                url: baseUrl
            },
            pagination: {
                prev: pageSeo.prev ?? undefined,
                next: pageSeo.next ?? undefined
            },
            jsonLd: [
                createBreadcrumbJsonLd([
                    { name: '홈', url: siteUrl },
                    { name: boardTitle, url: baseUrl }
                ])
            ]
        };
    });

    // 페이지 이동 (검색 파라미터 유지)
    function goToPage(pageNum: number): void {
        const url = new URL(window.location.href);
        url.searchParams.set('page', String(pageNum));
        goto(url.pathname + url.search);
    }
</script>

<!-- 특수 게시판: 플러그인 레지스트리 기반 동적 로딩 -->
{#if boardTypeComponent}
    {@const BoardTypeComponent = boardTypeComponent}
    <BoardTypeComponent {data} />
{:else}
    <SeoHead config={seoConfig} />

    {#if data.watermark}
        <Watermark
            nickname={data.watermark.nickname}
            userId={data.watermark.userId}
            clientIp={data.watermark.clientIp}
            pageTitle={data.board?.name || data.boardId}
            redirectUrl={'/' + data.boardId}
        />
    {/if}

    {#if !canList}
        <div class="mx-auto pt-4">
            <div class="bg-muted/50 mx-auto mt-12 max-w-md rounded-lg p-8 text-center">
                <Lock class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p class="text-muted-foreground text-lg font-medium">목록 보기 권한이 없습니다</p>
                <p class="text-muted-foreground mt-2 text-sm">{listPermissionMessage}</p>
                {#if !authStore.isAuthenticated}
                    <p class="text-muted-foreground mt-2 text-sm">
                        <button
                            type="button"
                            onclick={() => authStore.redirectToLogin()}
                            class="text-primary hover:underline"
                        >
                            로그인
                        </button>
                        이 필요합니다.
                    </p>
                {/if}
            </div>
        </div>
    {:else}
        <div class="mx-auto pt-4">
            <!-- 빠른 이동 네비게이션 -->
            <div class="mb-4">
                <TagNav />
            </div>

            <!-- 앙지도 헤더 -->
            {#if isAngmapBoard}
                <BoardMapHeader />
            {/if}

            <!-- 알뜰구매 쇼핑 바로가기 -->
            {#if isEconomyBoard}
                <EconomyShoppingBanner />
            {/if}

            <!-- 헤더 -->
            <div class="mb-4 flex items-center justify-between">
                <div class="flex shrink-0 items-center gap-2">
                    <h1 class="text-2xl font-bold sm:text-3xl">
                        <a
                            href="/{boardId}"
                            class="text-foreground hover:text-primary transition-colors"
                            onclick={(e) => {
                                if ($page.url.pathname === `/${boardId}` && !$page.url.search) {
                                    e.preventDefault();
                                    invalidateAll();
                                    window.scrollTo(0, 0);
                                }
                            }}
                        >
                            {boardTitle}
                        </a>
                    </h1>
                    <BoardFavoriteButton {boardId} {boardTitle} />
                    <BoardSubscribeButton {boardId} {boardTitle} />
                </div>

                <div class="flex items-center gap-2">
                    {#if listLayoutId === 'classic'}
                        <DropdownMenu>
                            <DropdownMenuTrigger>
                                {#snippet child({ props })}
                                    <Button
                                        {...props}
                                        variant="outline"
                                        size="icon"
                                        class="relative h-9 w-9 shrink-0"
                                        title="보기 설정"
                                    >
                                        <span class="absolute -inset-1.5"></span>
                                        <Settings2 class="h-4 w-4" />
                                    </Button>
                                {/snippet}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-44">
                                <!-- 화면 레이아웃 (데스크탑 전용) -->
                                <div class="hidden md:block">
                                    <DropdownMenuLabel class="text-xs font-semibold"
                                        >화면 레이아웃</DropdownMenuLabel
                                    >
                                    <DropdownMenuRadioGroup
                                        value={uiSettingsStore.listView}
                                        onValueChange={(v) =>
                                            (uiSettingsStore.listView = v as 'classic' | 'modern')}
                                    >
                                        <DropdownMenuRadioItem value="classic"
                                            >클래식</DropdownMenuRadioItem
                                        >
                                        <DropdownMenuRadioItem value="modern"
                                            >모던</DropdownMenuRadioItem
                                        >
                                    </DropdownMenuRadioGroup>
                                    <DropdownMenuSeparator />
                                </div>
                                <DropdownMenuLabel class="text-xs font-semibold"
                                    >읽은 글 표시</DropdownMenuLabel
                                >
                                <DropdownMenuRadioGroup
                                    value={readPostStyleStore.value}
                                    onValueChange={(v) =>
                                        readPostStyleStore.set(v as ReadPostStyle)}
                                >
                                    <DropdownMenuRadioItem value="dimmed"
                                        >흐림</DropdownMenuRadioItem
                                    >
                                    <DropdownMenuRadioItem value="bold">굵게</DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="italic"
                                        >기울임</DropdownMenuRadioItem
                                    >
                                    <DropdownMenuRadioItem value="underline"
                                        >밑줄</DropdownMenuRadioItem
                                    >
                                    <DropdownMenuRadioItem value="strikethrough"
                                        >취소선</DropdownMenuRadioItem
                                    >
                                </DropdownMenuRadioGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel class="text-xs font-semibold"
                                    >목록 밀도</DropdownMenuLabel
                                >
                                <DropdownMenuRadioGroup
                                    value={densityStore.value}
                                    onValueChange={(v) =>
                                        densityStore.set(v as 'compact' | 'balanced' | 'relaxed')}
                                >
                                    <DropdownMenuRadioItem value="compact"
                                        >촘촘</DropdownMenuRadioItem
                                    >
                                    <DropdownMenuRadioItem value="balanced"
                                        >보통</DropdownMenuRadioItem
                                    >
                                    <DropdownMenuRadioItem value="relaxed"
                                        >여유</DropdownMenuRadioItem
                                    >
                                </DropdownMenuRadioGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuCheckboxItem
                                    checked={uiSettingsStore.titleBold}
                                    onCheckedChange={(v) => (uiSettingsStore.titleBold = v)}
                                    >글 제목 굵게 표시</DropdownMenuCheckboxItem
                                >
                            </DropdownMenuContent>
                        </DropdownMenu>
                    {/if}
                    <div class="relative flex shrink-0">
                        {#if authStore.isAuthenticated}
                            <Button
                                variant="outline"
                                size="icon"
                                class="h-9 w-9 {uiSettingsStore.pinSearch
                                    ? 'rounded-r-none border-r-0'
                                    : ''}"
                                onclick={() => (showSearch = !showSearch)}
                                title="검색"
                            >
                                <Search class="h-4 w-4" />
                            </Button>
                            {#if showSearch || isSearching}
                                <Button
                                    variant="outline"
                                    size="icon"
                                    class="h-9 w-7 rounded-l-none px-0 {uiSettingsStore.pinSearch
                                        ? 'bg-primary/10 text-primary'
                                        : ''}"
                                    onclick={() => {
                                        uiSettingsStore.setPinSearch(!uiSettingsStore.pinSearch);
                                        if (uiSettingsStore.pinSearch) showSearch = true;
                                    }}
                                    title={uiSettingsStore.pinSearch
                                        ? '검색창 고정 해제'
                                        : '검색창 고정'}
                                >
                                    <Pin
                                        class="h-3 w-3 {uiSettingsStore.pinSearch
                                            ? 'fill-current'
                                            : ''}"
                                    />
                                </Button>
                            {/if}
                        {/if}
                    </div>
                    {#if canWrite}
                        <Button
                            onclick={goToWrite}
                            class="shrink-0"
                            title={!canUseCertifiedAction(authStore.user, boardId)
                                ? getCertificationBlockedMessage(boardId)
                                : undefined}
                        >
                            <Pencil class="mr-2 h-4 w-4" />
                            {#if !canUseCertifiedAction(authStore.user, boardId)}실명인증{:else}글쓰기{/if}
                        </Button>
                    {:else if authStore.isAuthenticated}
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
            </div>

            <!-- 최상단 자체 배너 (자체 배너 없으면 안 보임) -->
            {#if widgetLayoutStore.hasEnabledAds}
                <div class="mb-3">
                    <PluginSlot name="board-list-banner" />
                </div>
            {/if}

            <!-- 축하 메시지 롤링 (슬롯 기반) -->
            {#if !isSearching}
                <div class="mb-4">
                    <PluginSlot name="board-list-rolling" />
                </div>
            {/if}

            <!-- 축하메시지 아래 구글 광고 -->
            {#if widgetLayoutStore.hasEnabledAds}
                <div class="mb-3">
                    <AdSlot position="board-list-head" height="90px" slotKey="board-list-head" />
                </div>
            {/if}

            <!-- 검색 폼 (토글 or 검색 중 or 핀 고정) -->
            {#if showSearch || isSearching || uiSettingsStore.pinSearch}
                <div class="mb-3" transition:slide={{ duration: 200 }}>
                    <SearchForm boardPath={`/${boardId}`} />
                </div>
            {/if}

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
                        <button
                            onclick={clearTagFilter}
                            class="ml-1 rounded-full hover:bg-white/20"
                        >
                            <X class="h-3 w-3" />
                        </button>
                    </Badge>
                    <span class="text-muted-foreground text-sm">태그 필터 적용 중</span>
                </div>
            {/if}

            <!-- 에러 메시지 -->
            {#if postsResult.error}
                <Card class="border-destructive mb-6">
                    <CardContent class="pt-6">
                        <div class="flex flex-col items-center gap-3 text-center">
                            <p class="text-destructive">{postsResult.error}</p>
                            <Button variant="outline" size="sm" onclick={() => invalidateAll()}
                                >다시 시도</Button
                            >
                        </div>
                    </CardContent>
                </Card>
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
                            <Button
                                variant="ghost"
                                size="sm"
                                onclick={() => selectAllVisible(filteredPosts)}
                                >현재 페이지 전체 선택</Button
                            >
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- 게시글 목록 -->
            <div class={wrapperClass}>
                {#if listLayoutId === 'classic' && uiSettingsStore.listView !== 'modern'}
                    <div
                        class="border-border bg-muted/30 text-muted-foreground hidden border-b px-4 py-1.5 text-sm font-medium md:block"
                    >
                        <div class="grid grid-cols-[60px_1fr_auto_auto_auto] items-center gap-0">
                            <div class="text-center">공감</div>
                            <div>제목</div>
                            <div class="w-[120px] pl-1">이름</div>
                            <div class="w-[70px] pl-1 text-center">날짜</div>
                            <div class="w-[50px] pl-1 text-center">조회</div>
                        </div>
                    </div>
                {/if}
                <!-- 공지사항 (목록 내부) -->
                {#if hasNotices && !isSearching}
                    {#if listLayoutId === 'classic'}
                        {#each importantNotices as notice (notice.id)}
                            <a
                                href="/{boardId}/{notice.id}"
                                class="hover:bg-destructive/10 block px-4 py-1.5 no-underline transition-colors"
                                style="background: rgba(239, 68, 68, 0.04);"
                            >
                                <div class="flex items-center gap-2 md:gap-3">
                                    <div class="hidden shrink-0 md:block" style="width: 60px;">
                                        <div
                                            class="mx-auto flex h-5 w-10 items-center justify-center rounded-lg"
                                            style="background: rgba(239,68,68,0.1);"
                                        >
                                            <Megaphone
                                                class="h-3.5 w-3.5"
                                                style="color: orangered;"
                                            />
                                        </div>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1">
                                            <Megaphone
                                                class="text-destructive h-3.5 w-3.5 shrink-0 md:hidden"
                                            /><Badge
                                                variant="destructive"
                                                class="shrink-0 text-[10px]">필수</Badge
                                            >
                                            <h3
                                                class="text-foreground truncate font-medium"
                                                style="font-size: var(--list-font-size, 0.9375rem);"
                                            >
                                                {notice.title}
                                            </h3>
                                        </div>
                                    </div>
                                    <span
                                        class="text-muted-foreground hidden shrink-0 md:inline"
                                        style="font-size: 0.85em;">{notice.author}</span
                                    >
                                </div>
                            </a>
                        {/each}
                        {#each normalNotices as notice (notice.id)}
                            <a
                                href="/{boardId}/{notice.id}"
                                class="hover:bg-accent block px-4 py-1.5 no-underline transition-colors"
                                style="background: rgba(255, 255, 255, 0.03);"
                            >
                                <div class="flex items-center gap-2 md:gap-3">
                                    <div class="hidden shrink-0 md:block" style="width: 60px;">
                                        <div
                                            class="mx-auto flex h-5 w-10 items-center justify-center rounded-lg"
                                            style="background: rgba(239,68,68,0.1);"
                                        >
                                            <Pin class="h-3.5 w-3.5" style="color: orangered;" />
                                        </div>
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1">
                                            <Pin
                                                class="text-liked h-3.5 w-3.5 shrink-0 md:hidden"
                                            /><Badge
                                                class="shrink-0 text-[10px] font-semibold"
                                                style="background: rgba(239, 68, 68, 0.15); color: rgb(239, 68, 68); border: 1px solid rgba(239, 68, 68, 0.2);"
                                                >공지</Badge
                                            >
                                            <h3
                                                class="text-foreground truncate font-medium"
                                                style="font-size: var(--list-font-size, 0.9375rem);"
                                            >
                                                {notice.title}
                                            </h3>
                                        </div>
                                    </div>
                                    <span
                                        class="text-muted-foreground hidden shrink-0 md:inline"
                                        style="font-size: 0.85em;">{notice.author}</span
                                    >
                                </div>
                            </a>
                        {/each}
                    {:else}
                        {#each importantNotices as notice (notice.id)}
                            <a
                                href="/{boardId}/{notice.id}"
                                class="bg-destructive/5 border-destructive/20 hover:bg-destructive/10 block rounded-lg border px-4 py-3 no-underline transition-colors"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="flex shrink-0 items-center gap-1.5">
                                        <Megaphone class="text-destructive h-4 w-4" /><Badge
                                            variant="destructive"
                                            class="text-xs">필수</Badge
                                        >
                                    </div>
                                    <h3 class="text-foreground flex-1 truncate font-medium">
                                        {notice.title}
                                    </h3>
                                    <span class="text-muted-foreground shrink-0 text-xs"
                                        >{notice.author}</span
                                    >
                                </div>
                            </a>
                        {/each}
                        {#each normalNotices as notice (notice.id)}
                            <a
                                href="/{boardId}/{notice.id}"
                                class="bg-muted/50 border-border hover:bg-muted block rounded-lg border px-4 py-3 no-underline transition-colors"
                            >
                                <div class="flex items-center gap-3">
                                    <div class="flex shrink-0 items-center gap-1.5">
                                        <Pin class="text-muted-foreground h-4 w-4" /><Badge
                                            variant="secondary"
                                            class="text-xs">공지</Badge
                                        >
                                    </div>
                                    <h3 class="text-foreground flex-1 truncate font-medium">
                                        {notice.title}
                                    </h3>
                                    <span class="text-muted-foreground shrink-0 text-xs"
                                        >{notice.author}</span
                                    >
                                </div>
                            </a>
                        {/each}
                    {/if}
                {/if}
                {#if !postsResult.error && filteredPosts.length === 0}
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
                    {#each filteredPosts as post, i (post.id)}
                        {@const muted = uiSettingsStore.isMuted(post.title)}
                        {#if bulkSelectMode}
                            <div class="flex items-start gap-2" class:opacity-30={muted}>
                                <div class="flex shrink-0 items-center pt-3">
                                    <Checkbox
                                        checked={selectedPostIds.includes(post.id)}
                                        onCheckedChange={() => togglePostSelection(post.id)}
                                    />
                                </div>
                                <div class="min-w-0 flex-1">
                                    <LayoutComponent
                                        {post}
                                        displaySettings={data.board?.display_settings}
                                        memo={memoByAuthorId[post.author_id] ?? null}
                                        href="/{boardId}/{post.id}{listPage > 1
                                            ? `?page=${listPage}`
                                            : ''}"
                                        isRead={showReadState &&
                                            readPostsStore.isRead(boardId, post.id)}
                                        searchQuery={data.searchParams?.query || ''}
                                    />
                                </div>
                            </div>
                        {:else}
                            <div class:opacity-30={muted}>
                                <LayoutComponent
                                    {post}
                                    displaySettings={data.board?.display_settings}
                                    memo={memoByAuthorId[post.author_id] ?? null}
                                    href="/{boardId}/{post.id}{listPage > 1
                                        ? `?page=${listPage}`
                                        : ''}"
                                    isRead={showReadState &&
                                        readPostsStore.isRead(boardId, post.id)}
                                    searchQuery={data.searchParams?.query || ''}
                                />
                            </div>
                        {/if}
                        {#if widgetLayoutStore.hasEnabledAds && (i + 1 === 7 || i + 1 === 17)}
                            <div class="py-2">
                                <AdSlot
                                    position="board-list-infeed"
                                    height="90px"
                                    slotKey={`board-list-infeed-${i}`}
                                />
                            </div>
                        {/if}
                        {#if shuffledPromos.length > 0 && i + 1 === 12}
                            <PluginSlot
                                name="board-list-promotion"
                                posts={shuffledPromos}
                                variant={listLayoutId === 'classic' ? 'classic' : 'default'}
                            />
                        {/if}
                    {/each}
                {/if}
            </div>

            <!-- 페이지네이션 -->
            {#if shouldShowPagination}
                <div class="mt-8 flex items-center justify-center gap-2">
                    {#if pagination.page > 3}
                        <Button variant="outline" size="sm" onclick={() => goToPage(1)}>처음</Button
                        >
                    {/if}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page === 1}
                        onclick={() => goToPage(pagination.page - 1)}>이전</Button
                    >
                    {#each visiblePageNumbers as pageNum (pageNum)}
                        <Button
                            variant={pageNum === pagination.page ? 'default' : 'outline'}
                            size="sm"
                            onclick={() => goToPage(pageNum)}>{pageNum}</Button
                        >
                    {/each}
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!paginationHasNext}
                        onclick={() => goToPage(pagination.page + 1)}>다음</Button
                    >
                </div>
                {#if widgetLayoutStore.hasEnabledAds}
                    <div class="mt-3">
                        <AdSlot
                            position="board-list-bottom"
                            height="90px"
                            slotKey="board-list-bottom"
                        />
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
    <!-- /canList -->
{/if}

<!-- 모바일 FAB: 설정 + 글쓰기 -->
{#if canWrite}
    <div class="fixed bottom-4 right-4 z-50 flex flex-col items-center gap-2 md:hidden">
        <a
            href="/member/settings/ui"
            class="bg-muted text-muted-foreground flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-transform active:scale-95"
            aria-label="설정"
        >
            <Settings2 class="h-4 w-4" />
        </a>
        <button
            onclick={goToWrite}
            class="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
            aria-label="글쓰기"
        >
            <Pencil class="h-4 w-4" />
        </button>
    </div>
{/if}
