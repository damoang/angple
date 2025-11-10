<script lang="ts">
    import { onMount } from 'svelte';
    import type { NewsTabId, NewsPost } from '$lib/api/types.js';
    import { Card, CardContent } from '$lib/components/ui/card';
    import { NewsTabs } from './components/tabs';
    import { SimplePostList } from './components/post-list';

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
            // JSON 파일에서 데이터 로드
            const response = await fetch('/data/cache/recommended/index-widgets.json');
            if (!response.ok) throw new Error('데이터 로드 실패');

            const jsonData = await response.json();
            data = jsonData.news_tabs;
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

<Card class="gap-0 border-0 shadow-none">
    <div class="border-b px-3 pb-3 pt-3">
        <NewsTabs bind:activeTab onTabChange={handleTabChange} />
    </div>

    <CardContent class="px-3">
        {#if loading}
            <div class="flex items-center justify-center py-8">
                <div class="text-sm text-muted-foreground">로딩 중...</div>
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
