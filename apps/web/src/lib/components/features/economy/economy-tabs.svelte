<script lang="ts">
    import { onMount } from 'svelte';
    import type { EconomyTabId, EconomyPost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
    import { EconomyTabs } from './components/tabs';
    import { EconomyPostList } from './components/post-list';
    import { apiClient } from '$lib/api';

    let activeTab = $state<EconomyTabId>('economy');
    let data = $state<EconomyPost[] | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 탭별 포스트 필터링
    const currentPosts = $derived(data ? data.filter((post) => post.tab === activeTab) : []);

    async function loadData() {
        loading = true;
        error = null;
        try {
            const widgetsData = await apiClient.getIndexWidgets();
            data = widgetsData.economy_tabs;
        } catch (err) {
            error = err instanceof Error ? err.message : '데이터 로드 실패';
            console.error('경제 탭 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    function handleTabChange(tabId: EconomyTabId) {
        activeTab = tabId;
    }

    onMount(() => {
        loadData();
    });
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 px-4 py-2.5">
        <div class="flex items-center gap-2">
            <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30"
            >
                <ShoppingCart class="h-4 w-4 text-green-500" />
            </div>
            <h3 class="text-foreground text-base font-semibold">알뜰구매</h3>
        </div>
        <EconomyTabs bind:activeTab onTabChange={handleTabChange} />
    </CardHeader>

    <CardContent class="px-4">
        {#if loading}
            <div class="flex items-center justify-center py-8">
                <div class="text-muted-foreground text-sm">로딩 중...</div>
            </div>
        {:else if error}
            <div class="flex items-center justify-center py-8">
                <div class="text-center">
                    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        {:else if data}
            <EconomyPostList posts={currentPosts} />
        {/if}
    </CardContent>
</Card>
