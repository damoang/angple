<script lang="ts">
    /**
     * 범용 게시글 목록 위젯
     *
     * settings의 boardId, layout, sortBy, count, filter에 따라
     * 적절한 데이터를 fetch하고 레이아웃을 분기합니다.
     *
     * 기존 하드코딩 위젯(new-board, economy, gallery, group)을 대체합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { NewBoard } from '$lib/components/features/new-board';
    import { EconomyTabs } from '$lib/components/features/economy';
    import { GalleryGrid } from '$lib/components/features/gallery';
    import { GroupTabs } from '$lib/components/features/group';
    import ListView from './layouts/list-view.svelte';
    import GalleryView from './layouts/gallery-view.svelte';
    import GridView from './layouts/grid-view.svelte';
    import CardView from './layouts/card-view.svelte';
    import MessageView from './layouts/message-view.svelte';
    import GivingView from './layouts/giving-view.svelte';
    import TradeView from './layouts/trade-view.svelte';
    import type { EconomyPost, GalleryPost, GroupTabsData, NewsPost } from '$lib/api/types';

    interface DefaultLayoutPost {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: string;
        created_at?: string;
        comment_count?: number;
        view_count?: number;
        recommend_count?: number;
    }

    interface MessageLayoutPost {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: {
            id?: string;
            nickname?: string;
            avatar_url?: string;
            profile_url?: string;
        };
        external_link?: string;
        created_at?: string;
    }

    interface GivingLayoutPost {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: {
            id?: string;
            nickname?: string;
            avatar_url?: string;
        };
        giving_start?: string;
        giving_end?: string;
        is_paused?: boolean;
        bid_count?: number;
        comment_count?: number;
        created_at?: string;
    }

    interface TradeLayoutPost {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: {
            id?: string;
            nickname?: string;
            avatar_url?: string;
        };
        price?: number;
        original_price?: number;
        status?: 'selling' | 'reserved' | 'sold';
        trade_type?: 'direct' | 'shipping' | 'both';
        location?: string;
        like_count?: number;
        view_count?: number;
        comment_count?: number;
        created_at?: string;
        is_free?: boolean;
        is_negotiable?: boolean;
    }

    let { config, slot, isEditMode = false, prefetchData }: WidgetProps = $props();

    // settings에서 설정 읽기
    const boardId = $derived((config.settings?.boardId as string) ?? 'notice');
    const layout = $derived((config.settings?.layout as string) ?? 'list');
    const sortBy = $derived((config.settings?.sortBy as string) ?? 'date');
    const count = $derived((config.settings?.count as number) ?? 10);
    const filter = $derived((config.settings?.filter as string) ?? 'none');
    const showTitle = $derived((config.settings?.showTitle as boolean) ?? true);

    // 기존 스토어 기반 데이터를 boardId에 따라 분기
    // Phase 2에서는 기존 feature 컴포넌트를 래핑하여 호환성 유지
    // Phase 3에서 자체 API fetch로 전환 가능
    const useNativeComponent = $derived(
        ['notice', 'economy', 'gallery', 'group'].includes(boardId) &&
            layout === getDefaultLayout(boardId)
    );

    function getDefaultLayout(board: string): string {
        switch (board) {
            case 'gallery':
                return 'gallery';
            case 'group':
                return 'grid';
            default:
                return 'list';
        }
    }

    // API fetch 데이터 (기존 스토어에 없는 경우)
    let fetchedPosts = $state<
        DefaultLayoutPost[] | MessageLayoutPost[] | GivingLayoutPost[] | TradeLayoutPost[]
    >([]);
    let loading = $state(false);
    let error = $state<string | null>(null);

    const noticePosts = $derived(
        (prefetchData as NewsPost[] | undefined) ?? indexWidgetsStore.newsTabs
    );
    const economyPosts = $derived(
        (prefetchData as EconomyPost[] | undefined) ?? indexWidgetsStore.economyTabs
    );
    const galleryPosts = $derived(
        (prefetchData as GalleryPost[] | undefined) ?? indexWidgetsStore.gallery
    );
    const groupTabsData = $derived(
        (prefetchData as GroupTabsData | null | undefined) ?? indexWidgetsStore.groupTabs
    );
    const defaultPosts = $derived(fetchedPosts as DefaultLayoutPost[]);
    const messagePosts = $derived(fetchedPosts as MessageLayoutPost[]);
    const givingPosts = $derived(fetchedPosts as GivingLayoutPost[]);
    const tradePosts = $derived(fetchedPosts as TradeLayoutPost[]);

    // 기존 스토어 데이터가 아닌 경우 API에서 fetch
    $effect(() => {
        if (!useNativeComponent) {
            fetchPosts();
        }
    });

    async function fetchPosts() {
        loading = true;
        error = null;
        try {
            const params = new URLSearchParams({
                board: boardId,
                sort: sortBy,
                count: String(count),
                filter
            });
            const res = await fetch(`/api/widgets/post-list/data?${params}`);
            if (res.ok) {
                const data = await res.json();
                fetchedPosts = data.posts ?? [];
            } else {
                error = '데이터 로드 실패';
            }
        } catch (err) {
            error = err instanceof Error ? err.message : '네트워크 오류';
        } finally {
            loading = false;
        }
    }
</script>

{#if useNativeComponent}
    <!-- 기존 feature 컴포넌트 그대로 렌더링 (호환성 유지) -->
    {#if boardId === 'notice'}
        <NewBoard posts={noticePosts} />
    {:else if boardId === 'economy'}
        <EconomyTabs posts={economyPosts} />
    {:else if boardId === 'gallery'}
        <GalleryGrid posts={galleryPosts} />
    {:else if boardId === 'group'}
        <GroupTabs data={groupTabsData} />
    {/if}
{:else}
    <!-- 범용 레이아웃 렌더링 -->
    {#if loading}
        <div class="flex items-center justify-center py-8">
            <div class="text-muted-foreground text-sm">로딩 중...</div>
        </div>
    {:else if error}
        <div class="flex items-center justify-center py-8">
            <div class="text-sm text-red-600 dark:text-red-400">{error}</div>
        </div>
    {:else if layout === 'gallery'}
        <GalleryView posts={defaultPosts} {showTitle} {boardId} />
    {:else if layout === 'grid'}
        <GridView posts={defaultPosts} {showTitle} {boardId} />
    {:else if layout === 'card'}
        <CardView posts={defaultPosts} {showTitle} {boardId} />
    {:else if layout === 'message'}
        <MessageView posts={messagePosts} {showTitle} {boardId} />
    {:else if layout === 'giving'}
        <GivingView posts={givingPosts} {showTitle} {boardId} />
    {:else if layout === 'trade'}
        <TradeView posts={tradePosts} {showTitle} {boardId} />
    {:else}
        <ListView posts={defaultPosts} {showTitle} {boardId} />
    {/if}
{/if}
