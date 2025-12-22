<script lang="ts">
    import { onMount } from 'svelte';
    import type { NewsTabId, NewsPost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import { NewsTabs } from './components/tabs';
    import { SimplePostList } from './components/post-list';
    import { apiClient } from '$lib/api';

    let activeTab = $state<NewsTabId>('new');
    let data = $state<NewsPost[] | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 탭별 포스트 필터링
    const currentPosts = $derived(data ? data.filter((post) => post.tab === activeTab) : []);

    async function loadData() {
        loading = true;
        error = null;
        try {
            const widgetsData = await apiClient.getIndexWidgets();
            data = widgetsData.news_tabs;
        } catch (err) {
            error = err instanceof Error ? err.message : '데이터 로드 실패';
            console.error('새로운 소식 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    function handleTabChange(tabId: NewsTabId) {
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
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
            >
                <Newspaper class="h-4 w-4 text-blue-500" />
            </div>
            <h3 class="text-foreground text-base font-semibold">새로운 소식</h3>
        </div>
        <NewsTabs bind:activeTab onTabChange={handleTabChange} />
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
            <SimplePostList posts={currentPosts} />
        {/if}
    </CardContent>
</Card>
